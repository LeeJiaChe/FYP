import type {
  AnalyticsOverview,
  AnalyticsRange,
  AvailableLineFilterOption,
  DemandPressureRow,
  FleetPerformanceRow,
  HourlyRidershipRow,
  LineDirectionDetail,
  LinePerformanceRow,
  OperationsAnalyticsQuery,
  OperationsAnalyticsResponse,
  ReliabilityLineRow,
} from "../contracts/analytics.schemas";
import {
  averageOrNull,
  buildOperationalInsights,
  calculateFinalizedWaitlistPromotionRate,
  calculateMytPresetRange,
  departureDelayMinutes,
  isAdministrativeCleanupTrip,
  isAnalyticsCompletedTrip,
  isAnalyticsOperatedTrip,
  isDepartureOnTime,
  isReliabilityEligibleTrip,
  noShowPercent,
  percentageOrNull,
  utilizationPercent,
} from "../domain/metrics";
import {
  fetchOperationsAnalyticsRawData,
  noShowRows,
  utilizationRows,
} from "../infrastructure/analytics.prisma.server";
import { forbidden, validationError } from "@/shared/application/application-error";
import { systemClock, type Clock } from "@/shared/time/clock";

export interface AnalyticsActor {
  readonly role: string;
}

function boundedRange(query: OperationsAnalyticsQuery | AnalyticsRange, clock: Clock) {
  let from: Date;
  let to: Date;

  if (query.from && query.to) {
    from = query.from;
    to = query.to;
  } else if (query.from && !query.to) {
    from = query.from;
    to = clock.now();
  } else {
    // Default 30 days deterministic MYT range
    const preset = calculateMytPresetRange("30d", clock.now());
    from = preset.fromUtc;
    to = preset.toUtcExclusive;
  }

  if (from >= to) throw validationError("Analytics from must be before to");
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1_000) {
    throw validationError("Analytics range cannot exceed 366 days");
  }
  return { from, to };
}

function getMytHour(date: Date): number {
  try {
    const hourStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "numeric",
      hour12: false,
    }).format(date);
    const parsed = parseInt(hourStr, 10);
    return isNaN(parsed) ? date.getUTCHours() : parsed % 24;
  } catch {
    return (date.getUTCHours() + 8) % 24;
  }
}

interface TripMetricsAccumulator {
  scheduledTrips: number;
  operatedTrips: number;
  completedTrips: number;
  boardedPassengers: number;
  reservedSeatSegments: number;
  seatedCapacitySegments: number;
  eligibleBookingOutcomes: number;
  noShowCount: number;
  actualDepartureSamples: number;
  onTimeCount: number;
  totalDepartureDelayMinutes: number;
  maxDepartureDelayMinutes: number;
  unservedDemand: number;
  waitlistExpired: number;
  walkInsRejectedFull: number;
  currentWaitingCount: number;
  waitlistEntriesCount: number;
  waitlistPromotedCount: number;
  operationalCancellations: number;
  excludedAdminCleanups: number;
}

function createAccumulator(): TripMetricsAccumulator {
  return {
    scheduledTrips: 0,
    operatedTrips: 0,
    completedTrips: 0,
    boardedPassengers: 0,
    reservedSeatSegments: 0,
    seatedCapacitySegments: 0,
    eligibleBookingOutcomes: 0,
    noShowCount: 0,
    actualDepartureSamples: 0,
    onTimeCount: 0,
    totalDepartureDelayMinutes: 0,
    maxDepartureDelayMinutes: 0,
    unservedDemand: 0,
    waitlistExpired: 0,
    walkInsRejectedFull: 0,
    currentWaitingCount: 0,
    waitlistEntriesCount: 0,
    waitlistPromotedCount: 0,
    operationalCancellations: 0,
    excludedAdminCleanups: 0,
  };
}

export async function getOperationsAnalytics(
  actor: AnalyticsActor,
  query: OperationsAnalyticsQuery,
  clock: Clock = systemClock,
): Promise<OperationsAnalyticsResponse> {
  if (actor.role !== "ADMIN") {
    throw forbidden("Admin role required");
  }

  const { from, to } = boundedRange(query, clock);
  const raw = await fetchOperationsAnalyticsRawData(
    from,
    to,
    query.lineId,
    query.direction,
  );

  const availableLines: AvailableLineFilterOption[] = raw.lines.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
  }));

  const overviewAcc = createAccumulator();
  const hourlyRidershipMap = new Map<number, { boarded: number; byLine: Record<string, number> }>();
  for (let h = 6; h <= 23; h++) {
    hourlyRidershipMap.set(h, { boarded: 0, byLine: {} });
  }

  // Pre-process Trips & populate overview accumulator
  for (const trip of raw.trips) {
    const isCancelled = trip.status === "CANCELLED";
    const isAdminCleanup = isAdministrativeCleanupTrip(trip);

    overviewAcc.scheduledTrips++;

    if (isAdminCleanup) {
      overviewAcc.excludedAdminCleanups++;
      continue;
    }

    if (isCancelled) {
      overviewAcc.operationalCancellations++;
    }

    const isOperated = isAnalyticsOperatedTrip(trip, false);
    const isCompleted = isAnalyticsCompletedTrip(trip, false);

    if (isOperated) {
      overviewAcc.operatedTrips++;
      const segmentCount = trip.tripSegments.length;
      overviewAcc.seatedCapacitySegments += trip.seatedCapacity * segmentCount;
      overviewAcc.reservedSeatSegments += trip.reservedSeatSegmentsCount;
    }

    if (isCompleted) {
      overviewAcc.completedTrips++;
    }

    // Boarded passengers (Checked-in Bookings + WalkInJourneys)
    const boardedReserved = trip.bookings.filter((b) => b.checkedInAt !== null).length;
    const boardedWalkIn = trip.walkInJourneys.length;
    const tripBoarded = boardedReserved + boardedWalkIn;
    overviewAcc.boardedPassengers += tripBoarded;

    // Hourly Ridership (MYT)
    if (tripBoarded > 0) {
      const mytHour = getMytHour(trip.departureTime);
      if (!hourlyRidershipMap.has(mytHour)) {
        hourlyRidershipMap.set(mytHour, { boarded: 0, byLine: {} });
      }
      const hourSlot = hourlyRidershipMap.get(mytHour)!;
      hourSlot.boarded += tripBoarded;
      const lineCode = trip.route.line.code;
      hourSlot.byLine[lineCode] = (hourSlot.byLine[lineCode] || 0) + tripBoarded;
    }

    // Origin departure punctuality
    if (isReliabilityEligibleTrip(trip, false)) {
      const originStop = trip.tripStops[0];
      if (originStop?.actualDeparture) {
        overviewAcc.actualDepartureSamples++;
        if (isDepartureOnTime(originStop.plannedDeparture, originStop.actualDeparture)) {
          overviewAcc.onTimeCount++;
        }
        const delay = departureDelayMinutes(originStop.plannedDeparture, originStop.actualDeparture);
        overviewAcc.totalDepartureDelayMinutes += delay;
        if (delay > overviewAcc.maxDepartureDelayMinutes) {
          overviewAcc.maxDepartureDelayMinutes = delay;
        }
      }
    }

    // Bookings & No-Shows
    for (const b of trip.bookings) {
      if (
        b.status === "NO_SHOW" ||
        b.status === "COMPLETED" ||
        (b.checkedInAt !== null && b.status === "CONFIRMED")
      ) {
        overviewAcc.eligibleBookingOutcomes++;
        if (b.status === "NO_SHOW") {
          overviewAcc.noShowCount++;
        }
      }
    }

    // Unserved demand & Waitlist
    for (const w of trip.waitlistEntries) {
      overviewAcc.waitlistEntriesCount++;
      if (w.status === "EXPIRED") {
        overviewAcc.waitlistExpired++;
        overviewAcc.unservedDemand++;
      } else if (w.status === "PROMOTED") {
        overviewAcc.waitlistPromotedCount++;
      } else if (w.status === "WAITING") {
        overviewAcc.currentWaitingCount++;
      }
    }

    for (const wi of trip.walkInIntents) {
      if (wi.status === "REJECTED_FULL") {
        overviewAcc.walkInsRejectedFull++;
        overviewAcc.unservedDemand++;
      }
    }
  }

  // 1. Line Performance Aggregations
  const linePerformanceList: LinePerformanceRow[] = [];
  const linesToProcess = query.lineId
    ? raw.lines.filter((l) => l.id === query.lineId)
    : raw.lines;

  for (const line of linesToProcess) {
    const lineTrips = raw.trips.filter((t) => t.route.lineId === line.id);

    function calculateDirectionMetrics(direction: "OUTBOUND" | "INBOUND"): {
      detail: LineDirectionDetail;
      acc: TripMetricsAccumulator;
    } {
      const dirTrips = lineTrips.filter((t) => t.route.direction === direction);
      const acc = createAccumulator();

      for (const trip of dirTrips) {
        const isCancelled = trip.status === "CANCELLED";
        const isAdminCleanup = isAdministrativeCleanupTrip(trip);

        acc.scheduledTrips++;
        if (isAdminCleanup) {
          acc.excludedAdminCleanups++;
          continue;
        }
        if (isCancelled) acc.operationalCancellations++;

        const isOperated = isAnalyticsOperatedTrip(trip, false);
        const isCompleted = isAnalyticsCompletedTrip(trip, false);

        if (isOperated) {
          acc.operatedTrips++;
          acc.seatedCapacitySegments += trip.seatedCapacity * trip.tripSegments.length;
          acc.reservedSeatSegments += trip.reservedSeatSegmentsCount;
        }
        if (isCompleted) acc.completedTrips++;

        acc.boardedPassengers +=
          trip.bookings.filter((b) => b.checkedInAt !== null).length + trip.walkInJourneys.length;

        if (isReliabilityEligibleTrip(trip, false)) {
          const originStop = trip.tripStops[0];
          if (originStop?.actualDeparture) {
            acc.actualDepartureSamples++;
            if (isDepartureOnTime(originStop.plannedDeparture, originStop.actualDeparture)) {
              acc.onTimeCount++;
            }
            const delay = departureDelayMinutes(
              originStop.plannedDeparture,
              originStop.actualDeparture,
            );
            acc.totalDepartureDelayMinutes += delay;
            if (delay > acc.maxDepartureDelayMinutes) {
              acc.maxDepartureDelayMinutes = delay;
            }
          }
        }

        for (const b of trip.bookings) {
          if (
            b.status === "NO_SHOW" ||
            b.status === "COMPLETED" ||
            (b.checkedInAt !== null && b.status === "CONFIRMED")
          ) {
            acc.eligibleBookingOutcomes++;
            if (b.status === "NO_SHOW") acc.noShowCount++;
          }
        }

        for (const w of trip.waitlistEntries) {
          if (w.status === "EXPIRED") {
            acc.waitlistExpired++;
            acc.unservedDemand++;
          }
        }
        for (const wi of trip.walkInIntents) {
          if (wi.status === "REJECTED_FULL") {
            acc.walkInsRejectedFull++;
            acc.unservedDemand++;
          }
        }
      }

      const detail: LineDirectionDetail = {
        direction,
        scheduledTrips: acc.scheduledTrips,
        operatedTrips: acc.operatedTrips,
        completedTrips: acc.completedTrips,
        boardedPassengers: acc.boardedPassengers,
        reservedSeatSegmentUtilization: percentageOrNull(
          acc.reservedSeatSegments,
          acc.seatedCapacitySegments,
        ),
        eligibleBookingOutcomes: acc.eligibleBookingOutcomes,
        noShowCount: acc.noShowCount,
        noShowRate: percentageOrNull(acc.noShowCount, acc.eligibleBookingOutcomes),
        actualDepartureSamples: acc.actualDepartureSamples,
        onTimeDepartureRate: percentageOrNull(acc.onTimeCount, acc.actualDepartureSamples),
        averageDepartureDelayMinutes: averageOrNull(
          acc.totalDepartureDelayMinutes,
          acc.actualDepartureSamples,
        ),
        unservedDemand: acc.unservedDemand,
        waitlistExpired: acc.waitlistExpired,
        walkInsRejectedFull: acc.walkInsRejectedFull,
        operationalCancellationCount: acc.operationalCancellations,
      };

      return { detail, acc };
    }

    const outboundRes = calculateDirectionMetrics("OUTBOUND");
    const inboundRes = calculateDirectionMetrics("INBOUND");
    const outAcc = outboundRes.acc;
    const inAcc = inboundRes.acc;

    // Direct sum of raw counters (No rounding reconstruction!)
    const totalScheduled = outAcc.scheduledTrips + inAcc.scheduledTrips;
    const totalOperated = outAcc.operatedTrips + inAcc.operatedTrips;
    const totalCompleted = outAcc.completedTrips + inAcc.completedTrips;
    const totalBoarded = outAcc.boardedPassengers + inAcc.boardedPassengers;

    const lineSeatedCapacity = outAcc.seatedCapacitySegments + inAcc.seatedCapacitySegments;
    const lineReservedSeats = outAcc.reservedSeatSegments + inAcc.reservedSeatSegments;

    const totalEligible = outAcc.eligibleBookingOutcomes + inAcc.eligibleBookingOutcomes;
    const totalNoShows = outAcc.noShowCount + inAcc.noShowCount;

    const totalDepSamples = outAcc.actualDepartureSamples + inAcc.actualDepartureSamples;
    const totalOnTimeCount = outAcc.onTimeCount + inAcc.onTimeCount;
    const totalDelayMinutes = outAcc.totalDepartureDelayMinutes + inAcc.totalDepartureDelayMinutes;

    linePerformanceList.push({
      lineId: line.id,
      lineCode: line.code,
      lineName: line.name,
      scheduledTrips: totalScheduled,
      operatedTrips: totalOperated,
      completedTrips: totalCompleted,
      boardedPassengers: totalBoarded,
      reservedSeatSegmentUtilization: percentageOrNull(lineReservedSeats, lineSeatedCapacity),
      eligibleBookingOutcomes: totalEligible,
      noShowCount: totalNoShows,
      noShowRate: percentageOrNull(totalNoShows, totalEligible),
      actualDepartureSamples: totalDepSamples,
      onTimeDepartureRate: percentageOrNull(totalOnTimeCount, totalDepSamples),
      averageDepartureDelayMinutes: averageOrNull(totalDelayMinutes, totalDepSamples),
      unservedDemand: outAcc.unservedDemand + inAcc.unservedDemand,
      waitlistExpired: outAcc.waitlistExpired + inAcc.waitlistExpired,
      walkInsRejectedFull: outAcc.walkInsRejectedFull + inAcc.walkInsRejectedFull,
      operationalCancellationCount:
        outAcc.operationalCancellations + inAcc.operationalCancellations,
      directions: {
        outbound: outboundRes.detail,
        inbound: inboundRes.detail,
      },
    });
  }

  // 2. Hourly Ridership Array
  const hourlyRidership: HourlyRidershipRow[] = Array.from(hourlyRidershipMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, data]) => ({
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      boardedRidership: data.boarded,
      byLine: data.byLine,
    }));

  // 3. Demand Pressure Rows
  const demandPressure: DemandPressureRow[] = linePerformanceList.map((line) => ({
    lineId: line.lineId,
    lineCode: line.lineCode,
    lineName: line.lineName,
    unservedDemand: line.unservedDemand,
    waitlistExpired: line.waitlistExpired,
    walkInsRejectedFull: line.walkInsRejectedFull,
    reservedSeatSegmentUtilization: line.reservedSeatSegmentUtilization,
    operatedTrips: line.operatedTrips,
    pressureFlag:
      line.operatedTrips >= 3 &&
      line.reservedSeatSegmentUtilization !== null &&
      line.reservedSeatSegmentUtilization >= 80 &&
      line.unservedDemand >= 1,
  }));

  // 4. Reliability Breakdown (Filtering strictly with isReliabilityEligibleTrip)
  const reliabilityLines: ReliabilityLineRow[] = linePerformanceList.map((line) => {
    const lineTripsWithDep = raw.trips.filter(
      (t) =>
        t.route.lineId === line.lineId &&
        isReliabilityEligibleTrip(t, isAdministrativeCleanupTrip(t)),
    );
    const maxDelay =
      lineTripsWithDep.length > 0
        ? Math.max(
            0,
            ...lineTripsWithDep.map((t) =>
              departureDelayMinutes(t.tripStops[0]!.plannedDeparture, t.tripStops[0]!.actualDeparture!),
            ),
          )
        : null;

    return {
      lineId: line.lineId,
      lineCode: line.lineCode,
      lineName: line.lineName,
      onTimeDepartureRate: line.onTimeDepartureRate,
      averageDepartureDelayMinutes: line.averageDepartureDelayMinutes,
      maxDepartureDelayMinutes: maxDelay,
      actualDepartureSamples: line.actualDepartureSamples,
      operationalCancellations: line.operationalCancellationCount,
    };
  });

  // 5. Fleet Performance
  const fleetPerformance: FleetPerformanceRow[] = raw.buses.map((bus) => {
    const busTrips = raw.trips.filter((t) => t.busId === bus.id);
    let busOperated = 0;
    let busCompleted = 0;
    let busBoarded = 0;
    let busCapacitySegments = 0;
    let busReservedSegments = 0;
    let busOperationalCancellations = 0;
    let totalServiceMs = 0;
    let validCompletedWithTimestamps = 0;

    for (const trip of busTrips) {
      const isCancelled = trip.status === "CANCELLED";
      const isAdminCleanup = isAdministrativeCleanupTrip(trip);

      if (isAdminCleanup) continue;
      if (isCancelled) busOperationalCancellations++;

      const isOperated = isAnalyticsOperatedTrip(trip, false);
      if (isOperated) {
        busOperated++;
        busCapacitySegments += trip.seatedCapacity * trip.tripSegments.length;
        busReservedSegments += trip.reservedSeatSegmentsCount;
      }

      if (isAnalyticsCompletedTrip(trip, false)) {
        busCompleted++;
        const originStop = trip.tripStops[0];
        const terminalStop = trip.tripStops[trip.tripStops.length - 1];
        if (originStop?.actualDeparture && terminalStop?.actualArrival) {
          const duration = terminalStop.actualArrival.getTime() - originStop.actualDeparture.getTime();
          if (duration > 0) {
            totalServiceMs += duration;
            validCompletedWithTimestamps++;
          }
        }
      }

      busBoarded +=
        trip.bookings.filter((b) => b.checkedInAt !== null).length + trip.walkInJourneys.length;
    }

    return {
      busId: bus.id,
      plateNumber: bus.plateNumber,
      status: bus.status,
      operatedTrips: busOperated,
      completedTrips: busCompleted,
      boardedPassengers: busBoarded,
      reservedSeatSegmentUtilization: percentageOrNull(busReservedSegments, busCapacitySegments),
      actualServiceHours:
        validCompletedWithTimestamps > 0
          ? Math.round((totalServiceMs / 3_600_000) * 10) / 10
          : null,
      operationalCancellationCount: busOperationalCancellations,
    };
  });

  // 6. Overview Metrics
  const waitlistFinalizedOutcomes =
    overviewAcc.waitlistPromotedCount + overviewAcc.waitlistExpired;
  const promotionRate = calculateFinalizedWaitlistPromotionRate(
    overviewAcc.waitlistPromotedCount,
    overviewAcc.waitlistExpired,
  );

  const overview: AnalyticsOverview = {
    boardedPassengers: overviewAcc.boardedPassengers,
    reservedSeatSegmentUtilization: percentageOrNull(
      overviewAcc.reservedSeatSegments,
      overviewAcc.seatedCapacitySegments,
    ),
    onTimeDepartureRate: percentageOrNull(
      overviewAcc.onTimeCount,
      overviewAcc.actualDepartureSamples,
    ),
    averageDepartureDelayMinutes: averageOrNull(
      overviewAcc.totalDepartureDelayMinutes,
      overviewAcc.actualDepartureSamples,
    ),
    noShowRate: percentageOrNull(overviewAcc.noShowCount, overviewAcc.eligibleBookingOutcomes),
    unservedDemand: overviewAcc.unservedDemand,
    operationalCancellations: overviewAcc.operationalCancellations,
    totalScheduledTrips: overviewAcc.scheduledTrips,
    operatedTrips: overviewAcc.operatedTrips,
    completedTrips: overviewAcc.completedTrips,
    eligibleBookingOutcomes: overviewAcc.eligibleBookingOutcomes,
    noShowCount: overviewAcc.noShowCount,
    actualDepartureSamples: overviewAcc.actualDepartureSamples,
    waitlistExpired: overviewAcc.waitlistExpired,
    walkInsRejectedFull: overviewAcc.walkInsRejectedFull,
    currentWaitingCount: overviewAcc.currentWaitingCount,
    waitlistEntries: overviewAcc.waitlistEntriesCount,
    waitlistPromoted: overviewAcc.waitlistPromotedCount,
    waitlistFinalizedOutcomes,
    promotionRate,
  };

  // 7. Operational Insights
  const insights = buildOperationalInsights(
    linePerformanceList.map((l) => ({
      lineCode: l.lineCode,
      lineName: l.lineName,
      operatedTrips: l.operatedTrips,
      reservedSeatSegmentUtilization: l.reservedSeatSegmentUtilization,
      unservedDemand: l.unservedDemand,
      actualDepartureSamples: l.actualDepartureSamples,
      onTimeDepartureRate: l.onTimeDepartureRate,
      averageDepartureDelayMinutes: l.averageDepartureDelayMinutes,
    })),
    {
      eligibleBookingOutcomes: overview.eligibleBookingOutcomes,
      noShowRate: overview.noShowRate,
      completedTripSamples: overview.completedTrips,
      totalLines: raw.lines.length,
    },
  );

  const allEligibleDepTrips = raw.trips.filter((t) =>
    isReliabilityEligibleTrip(t, isAdministrativeCleanupTrip(t)),
  );
  const overviewMaxDelay =
    allEligibleDepTrips.length > 0
      ? Math.max(
          0,
          ...allEligibleDepTrips.map((t) =>
            departureDelayMinutes(t.tripStops[0]!.plannedDeparture, t.tripStops[0]!.actualDeparture!),
          ),
        )
      : null;

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: "Asia/Kuala_Lumpur",
    },
    filters: {
      lineId: query.lineId ?? null,
      direction: query.direction ?? null,
    },
    availableLines,
    overview,
    linePerformance: linePerformanceList,
    hourlyRidership,
    demandPressure,
    reliability: {
      overview: {
        onTimeDepartureRate: overview.onTimeDepartureRate,
        averageDepartureDelayMinutes: overview.averageDepartureDelayMinutes,
        maxDepartureDelayMinutes: overviewMaxDelay,
        actualDepartureSamples: overviewAcc.actualDepartureSamples,
        operationalCancellations: overviewAcc.operationalCancellations,
      },
      byLine: reliabilityLines,
    },
    fleetPerformance,
    insights,
    dataQuality: {
      excludedAdministrativeCleanupTrips: overviewAcc.excludedAdminCleanups,
      completedTripSamples: overviewAcc.completedTrips,
      actualDepartureSamples: overviewAcc.actualDepartureSamples,
      eligibleBookingOutcomes: overviewAcc.eligibleBookingOutcomes,
      hasSufficientReliabilitySample: overviewAcc.actualDepartureSamples >= 3,
      hasSufficientNoShowSample: overviewAcc.eligibleBookingOutcomes >= 10,
      prototypeData: true,
      timezone: "Asia/Kuala_Lumpur",
    },
  };
}


export async function routeUtilization(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  const dates = boundedRange(range, clock);
  const rows = await utilizationRows(dates.from, dates.to);
  return rows.map((row) => {
    const seatedCapacitySegments = Number(row.seatedCapacitySegments);
    const reservedSeatSegments = Number(row.reservedSeatSegments);
    const standingCapacitySegments = Number(row.standingCapacitySegments);
    const standingSegmentClaims = Number(row.standingSegmentClaims);
    const fullRouteName = row.routeName;
    return {
      routeId: row.routeId,
      routeName: fullRouteName.split(":")[1]?.trim() || fullRouteName,
      fullRouteName,
      totalTrips: Number(row.totalTrips),
      seatedCapacitySegments,
      reservedSeatSegments,
      seatedUtilizationRate: utilizationPercent(reservedSeatSegments, seatedCapacitySegments),
      utilizationRate: utilizationPercent(reservedSeatSegments, seatedCapacitySegments),
      standingCapacitySegments,
      standingSegmentClaims,
      standingUtilizationRate: utilizationPercent(standingSegmentClaims, standingCapacitySegments),
      ridership: Number(row.boardedReserved) + Number(row.boardedWalkIn),
      demand: Number(row.demand),
    };
  });
}

export async function routeNoShowRates(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  const dates = boundedRange(range, clock);
  const rows = await noShowRows(dates.from, dates.to);
  return rows.map((row) => ({
    routeId: row.routeId,
    routeName: row.routeName.split(":")[1]?.trim() || row.routeName,
    fullRouteName: row.routeName,
    totalBookings: Number(row.eligibleOutcomes),
    totalNoShows: Number(row.noShows),
    totalCompleted: Number(row.completed),
    noShowRate: noShowPercent(Number(row.noShows), Number(row.eligibleOutcomes)),
  }));
}


