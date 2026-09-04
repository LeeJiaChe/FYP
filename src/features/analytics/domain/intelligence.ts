import { createHash } from "node:crypto";

import { evaluateAdjacentBusTransition } from "@/features/trips/public";
import { productPolicy } from "@/shared/config/policies";
import { getMytHour } from "@/shared/time/operational-time";
import type { OperationsAnalyticsResponse } from "../contracts/analytics.schemas";
import type {
  AnalyticsSignal,
  AnalyticsSnapshot,
  EvidenceMetric,
  EvidenceStrength,
  FleetIntelligenceRow,
  OriginDestinationRow,
  SegmentLoadRow,
  TimeBucketIntelligenceRow,
  TripEvidenceRow,
} from "../contracts/intelligence.schemas";
import type { OperationsAnalyticsRawData } from "../infrastructure/analytics.prisma.server";
import {
  departureDelayMinutes,
  isAdministrativeCleanupTrip,
  isAnalyticsOperatedTrip,
  percentageOrNull,
} from "./metrics";
import {
  analyticsIntelligencePolicy,
  type AnalyticsIntelligencePolicy,
} from "./intelligence-policy";

type RawTrip = OperationsAnalyticsRawData["trips"][number];

const severityPriority = {
  HIGH: 5,
  MEDIUM: 4,
  WATCH: 3,
  POSITIVE: 2,
  INFO: 1,
} as const;
const strengthPriority = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
const exceptionPriority: Partial<Record<AnalyticsSignal["type"], number>> = {
  ACTIVE_DRIVER_CONFLICT: 5,
  OVERDUE_UNSTARTED_TRIP: 4,
  TRIP_WITHOUT_DRIVER: 3,
  STALE_TELEMETRY: 2,
  SIGNIFICANT_EXPECTED_DELAY: 1,
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "generatedAt" && key !== "fingerprint")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function analyticsFingerprint(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)), "utf8")
    .digest("hex");
}

function signalId(type: string, scope: object, period: { from: string; to: string }) {
  return `${type.toLowerCase()}-${analyticsFingerprint({ type, scope, period }).slice(0, 12)}`;
}

function evidenceStrength(
  sampleSize: number,
  hasComparison: boolean,
  policy: AnalyticsIntelligencePolicy,
): EvidenceStrength {
  if (sampleSize >= policy.highEvidenceSample && hasComparison) return "HIGH";
  if (sampleSize >= policy.minimumOperationalSample) return "MEDIUM";
  return "LOW";
}

function countChange(current: number, previous: number) {
  return current - previous;
}

function rateChange(current: number | null, previous: number | null) {
  return current === null || previous === null ? null : current - previous;
}

function demandChangePercent(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function bucketForHour(hour: number) {
  if (hour < 6) return { bucket: "OVERNIGHT", label: "00:00–05:59" };
  if (hour < 10) return { bucket: "MORNING", label: "06:00–09:59" };
  if (hour < 15) return { bucket: "MIDDAY", label: "10:00–14:59" };
  if (hour < 20) return { bucket: "EVENING", label: "15:00–19:59" };
  return { bucket: "NIGHT", label: "20:00–23:59" };
}

function buildTimeBuckets(trips: readonly RawTrip[]): TimeBucketIntelligenceRow[] {
  const rows = new Map<
    string,
    TimeBucketIntelligenceRow & {
      reservedSeatSegments: number;
      seatedCapacitySegments: number;
    }
  >();
  for (const trip of trips) {
    if (isAdministrativeCleanupTrip(trip)) continue;
    const time = bucketForHour(getMytHour(trip.departureTime));
    const key = `${trip.route.lineId}:${trip.route.direction}:${time.bucket}`;
    const row = rows.get(key) ?? {
      lineId: trip.route.lineId,
      lineCode: trip.route.line.code,
      lineName: trip.route.line.name,
      direction: trip.route.direction,
      bucket: time.bucket,
      label: time.label,
      boardedPassengers: 0,
      reservedSeatSegmentUtilization: null,
      unservedDemand: 0,
      operatedTrips: 0,
      reservedSeatSegments: 0,
      seatedCapacitySegments: 0,
    };
    const boardedPassengers = row.boardedPassengers +
      trip.bookings.filter((booking) => booking.checkedInAt !== null).length +
      trip.walkInJourneys.length;
    const unservedDemand = row.unservedDemand +
      trip.waitlistEntries.filter((entry) => entry.status === "EXPIRED").length +
      trip.walkInIntents.filter((intent) => intent.status === "REJECTED_FULL").length;
    let operatedTrips = row.operatedTrips;
    let reservedSeatSegments = row.reservedSeatSegments;
    let seatedCapacitySegments = row.seatedCapacitySegments;
    if (isAnalyticsOperatedTrip(trip, false)) {
      operatedTrips += 1;
      reservedSeatSegments += trip.reservedSeatSegmentsCount;
      seatedCapacitySegments += trip.seatedCapacity * trip.tripSegments.length;
    }
    rows.set(key, {
      ...row,
      boardedPassengers,
      unservedDemand,
      operatedTrips,
      reservedSeatSegments,
      seatedCapacitySegments,
    });
  }
  return [...rows.values()]
    .map(({ reservedSeatSegments, seatedCapacitySegments, ...row }) => ({
      ...row,
      reservedSeatSegmentUtilization: percentageOrNull(
        reservedSeatSegments,
        seatedCapacitySegments,
      ),
    }))
    .sort(
      (left, right) =>
        left.lineCode.localeCompare(right.lineCode) ||
        left.label.localeCompare(right.label) ||
        left.direction.localeCompare(right.direction),
    );
}

function buildOriginDestination(trips: readonly RawTrip[]): OriginDestinationRow[] {
  const rows = new Map<string, OriginDestinationRow>();
  const add = (
    trip: RawTrip,
    boarding: { stopCode: string; stopName: string },
    dropOff: { stopCode: string; stopName: string },
    field: "boardedReserved" | "boardedWalkIn" | "unservedDemand",
  ) => {
    const key = `${trip.route.lineId}:${trip.route.direction}:${boarding.stopCode}:${dropOff.stopCode}`;
    const current = rows.get(key) ?? {
      lineId: trip.route.lineId,
      lineCode: trip.route.line.code,
      direction: trip.route.direction,
      boardingStopCode: boarding.stopCode,
      boardingStopName: boarding.stopName,
      dropOffStopCode: dropOff.stopCode,
      dropOffStopName: dropOff.stopName,
      boardedReserved: 0,
      boardedWalkIn: 0,
      boardedJourneys: 0,
      unservedDemand: 0,
    };
    const next = { ...current, [field]: current[field] + 1 };
    rows.set(key, {
      ...next,
      boardedJourneys: next.boardedReserved + next.boardedWalkIn,
    });
  };

  for (const trip of trips) {
    if (isAdministrativeCleanupTrip(trip)) continue;
    for (const booking of trip.bookings) {
      if (booking.checkedInAt) {
        add(trip, booking.boardingTripStop, booking.dropOffTripStop, "boardedReserved");
      }
    }
    for (const journey of trip.walkInJourneys) {
      add(trip, journey.boardingTripStop, journey.dropOffTripStop, "boardedWalkIn");
    }
    for (const entry of trip.waitlistEntries) {
      if (entry.status === "EXPIRED") {
        add(trip, entry.boardingTripStop, entry.dropOffTripStop, "unservedDemand");
      }
    }
    for (const intent of trip.walkInIntents) {
      if (intent.status === "REJECTED_FULL") {
        add(trip, intent.boardingTripStop, intent.dropOffTripStop, "unservedDemand");
      }
    }
  }
  return [...rows.values()].sort(
    (left, right) =>
      right.boardedJourneys - left.boardedJourneys ||
      right.unservedDemand - left.unservedDemand,
  );
}

function buildSegmentLoads(trips: readonly RawTrip[]): SegmentLoadRow[] {
  const rows = new Map<string, SegmentLoadRow>();
  for (const trip of trips) {
    if (
      isAdministrativeCleanupTrip(trip) ||
      !isAnalyticsOperatedTrip(trip, false)
    ) continue;
    for (const segment of trip.tripSegments) {
      const from = trip.tripStops[segment.position];
      const to = trip.tripStops[segment.position + 1];
      if (!from || !to) continue;
      const key = `${trip.route.lineId}:${trip.route.direction}:${from.stopCode}:${to.stopCode}`;
      const current = rows.get(key) ?? {
        lineId: trip.route.lineId,
        lineCode: trip.route.line.code,
        direction: trip.route.direction,
        fromStopCode: from.stopCode,
        fromStopName: from.stopName,
        toStopCode: to.stopCode,
        toStopName: to.stopName,
        reservedClaims: 0,
        standingClaims: 0,
      };
      rows.set(key, {
        ...current,
        reservedClaims: current.reservedClaims + segment.reservedSeatSegmentsCount,
        standingClaims: current.standingClaims + segment.standingClaimsCount,
      });
    }
  }
  return [...rows.values()].sort(
    (left, right) =>
      right.reservedClaims + right.standingClaims -
      (left.reservedClaims + left.standingClaims),
  );
}

function buildFleet(
  trips: readonly RawTrip[],
  analytics: OperationsAnalyticsResponse,
): FleetIntelligenceRow[] {
  const operatedTotal = analytics.overview.operatedTrips;
  return analytics.fleetPerformance.map((performance) => {
    const scheduled = trips
      .filter(
        (trip) =>
          trip.busId === performance.busId &&
          trip.status !== "CANCELLED" &&
          !isAdministrativeCleanupTrip(trip),
      )
      .sort(
        (left, right) => left.departureTime.getTime() - right.departureTime.getTime(),
      );
    let idleMs = 0;
    let turnaroundAdvisories = 0;
    let deadheadAdvisories = 0;
    for (let index = 1; index < scheduled.length; index += 1) {
      const previous = scheduled[index - 1]!;
      const current = scheduled[index]!;
      const gap = Math.max(
        0,
        current.departureTime.getTime() - previous.estimatedArrivalTime.getTime(),
      );
      idleMs += gap;
      const transition = evaluateAdjacentBusTransition(
        previous,
        current,
        productPolicy,
      );
      if (transition?.status === "TURNAROUND_TOO_SHORT") turnaroundAdvisories += 1;
      if (
        transition?.status === "DEADHEAD_REQUIRED" ||
        transition?.status === "DEADHEAD_TIME_INSUFFICIENT"
      ) deadheadAdvisories += 1;
    }
    const first = scheduled[0];
    const last = scheduled.at(-1);
    return {
      busId: performance.busId,
      plateNumber: performance.plateNumber,
      scheduledTrips: scheduled.length,
      operatedTrips: performance.operatedTrips,
      completedTrips: performance.completedTrips,
      actualServiceHours: performance.actualServiceHours,
      scheduledOperatingSpanHours:
        first && last
          ? Math.round(
              ((last.estimatedArrivalTime.getTime() - first.departureTime.getTime()) /
                3_600_000) *
                10,
            ) / 10
          : null,
      scheduledIdleGapHours: Math.round((idleMs / 3_600_000) * 10) / 10,
      workloadSharePercent: percentageOrNull(
        performance.operatedTrips,
        operatedTotal,
      ),
      turnaroundAdvisories,
      deadheadAdvisories,
    };
  }).filter(
    (bus) =>
      (!analytics.filters.lineId && !analytics.filters.direction) ||
      bus.scheduledTrips > 0,
  );
}

function buildTripEvidence(trips: readonly RawTrip[]): TripEvidenceRow[] {
  return trips
    .filter((trip) => !isAdministrativeCleanupTrip(trip))
    .map((trip) => {
      const origin = trip.tripStops[0];
      return {
        tripId: trip.id,
        lineId: trip.route.lineId,
        lineCode: trip.route.line.code,
        direction: trip.route.direction,
        busId: trip.busId,
        plateNumber: trip.bus.plateNumber,
        departureTime: trip.departureTime.toISOString(),
        status: trip.status,
        actualDepartureTime: origin?.actualDeparture?.toISOString() ?? null,
        actualDepartureDelayMinutes:
          origin?.actualDeparture
            ? departureDelayMinutes(origin.plannedDeparture, origin.actualDeparture)
            : null,
        boardedPassengers:
          trip.bookings.filter((booking) => booking.checkedInAt !== null).length +
          trip.walkInJourneys.length,
        reservedSeatSegmentUtilization: percentageOrNull(
          trip.reservedSeatSegmentsCount,
          trip.seatedCapacity * trip.tripSegments.length,
        ),
        unservedDemand:
          trip.waitlistEntries.filter((entry) => entry.status === "EXPIRED").length +
          trip.walkInIntents.filter((intent) => intent.status === "REJECTED_FULL").length,
      };
    })
    .sort((left, right) => right.departureTime.localeCompare(left.departureTime))
    .slice(0, 150);
}

function addEvidence(
  evidence: Record<string, EvidenceMetric>,
  metric: EvidenceMetric,
) {
  evidence[metric.key] = metric;
  return metric.key;
}

function makeSignal(
  input: Omit<AnalyticsSignal, "id">,
): AnalyticsSignal {
  return {
    ...input,
    id: signalId(input.type, input.scope, input.period),
  };
}

export function buildAnalyticsSnapshot(input: {
  current: OperationsAnalyticsResponse;
  previous: OperationsAnalyticsResponse;
  currentRaw: OperationsAnalyticsRawData;
  currentExceptionTrips: readonly RawTrip[];
  now: Date;
  policy?: AnalyticsIntelligencePolicy;
}): AnalyticsSnapshot {
  const policy = input.policy ?? analyticsIntelligencePolicy;
  const { current, previous } = input;
  const period = { from: current.range.from, to: current.range.to };
  const comparisonAvailable = previous.overview.operatedTrips > 0;
  const timeBuckets = buildTimeBuckets(input.currentRaw.trips);
  const originDestination = buildOriginDestination(input.currentRaw.trips);
  const segmentLoads = buildSegmentLoads(input.currentRaw.trips);
  const fleet = buildFleet(input.currentRaw.trips, current);
  const tripEvidence = buildTripEvidence(input.currentRaw.trips);
  const evidence: Record<string, EvidenceMetric> = {};
  const signals: AnalyticsSignal[] = [];

  const networkMetric = (
    key: string,
    label: string,
    value: number | null,
    unit: EvidenceMetric["unit"],
    sampleSize: number,
  ) => addEvidence(evidence, { key: `network.${key}`, label, value, unit, sampleSize });
  networkMetric(
    "boardedPassengers",
    "Boarded riders",
    current.overview.boardedPassengers,
    "COUNT",
    current.overview.operatedTrips,
  );
  networkMetric(
    "reservedSeatSegmentUtilization",
    "Reserved seat-segment utilisation",
    current.overview.reservedSeatSegmentUtilization,
    "PERCENT",
    current.overview.operatedTrips,
  );
  networkMetric(
    "onTimeDepartureRate",
    "On-time departure",
    current.overview.onTimeDepartureRate,
    "PERCENT",
    current.overview.actualDepartureSamples,
  );
  networkMetric(
    "averageDepartureDelayMinutes",
    "Average actual departure delay",
    current.overview.averageDepartureDelayMinutes,
    "MINUTES",
    current.overview.actualDepartureSamples,
  );
  networkMetric(
    "unservedDemand",
    "Unserved demand",
    current.overview.unservedDemand,
    "COUNT",
    current.overview.operatedTrips,
  );
  networkMetric(
    "noShowRate",
    "No-show rate",
    current.overview.noShowRate,
    "PERCENT",
    current.overview.eligibleBookingOutcomes,
  );

  for (const line of current.linePerformance) {
    const old = previous.linePerformance.find((item) => item.lineId === line.lineId);
    const keys = {
      utilisation: addEvidence(evidence, {
        key: `line.${line.lineId}.reservedSeatSegmentUtilization`,
        label: `${line.lineCode} reserved seat-segment utilisation`,
        value: line.reservedSeatSegmentUtilization,
        unit: "PERCENT",
        sampleSize: line.operatedTrips,
      }),
      unserved: addEvidence(evidence, {
        key: `line.${line.lineId}.unservedDemand`,
        label: `${line.lineCode} unserved demand`,
        value: line.unservedDemand,
        unit: "COUNT",
        sampleSize: line.operatedTrips,
      }),
      onTime: addEvidence(evidence, {
        key: `line.${line.lineId}.onTimeDepartureRate`,
        label: `${line.lineCode} on-time departure`,
        value: line.onTimeDepartureRate,
        unit: "PERCENT",
        sampleSize: line.actualDepartureSamples,
      }),
      boarded: addEvidence(evidence, {
        key: `line.${line.lineId}.boardedPassengers`,
        label: `${line.lineCode} boarded riders`,
        value: line.boardedPassengers,
        unit: "COUNT",
        sampleSize: line.operatedTrips,
      }),
    };
    if (
      line.operatedTrips >= policy.minimumOperationalSample &&
      line.reservedSeatSegmentUtilization !== null &&
      line.reservedSeatSegmentUtilization >= policy.capacityPressurePercent &&
      line.unservedDemand >= 1
    ) {
      signals.push(
        makeSignal({
          type: "CAPACITY_PRESSURE",
          severity:
            line.reservedSeatSegmentUtilization >= policy.severeCapacityPressurePercent ||
            line.unservedDemand >= policy.severeUnservedDemand
              ? "HIGH"
              : "MEDIUM",
          category: "CAPACITY",
          scope: { lineId: line.lineId, lineCode: line.lineCode },
          headline: `${line.lineCode} capacity pressure`,
          observation: `${line.reservedSeatSegmentUtilization}% reserved seat-segment utilisation with ${line.unservedDemand} unserved journeys.`,
          deterministicInterpretation:
            "Demand is pressing against usable seated capacity in the selected period.",
          recommendedReview: "Review peak-window frequency and vehicle capacity allocation.",
          recommendationLevel: "CONSIDER",
          observedValue: line.reservedSeatSegmentUtilization,
          comparisonValue: old?.reservedSeatSegmentUtilization ?? null,
          change: rateChange(
            line.reservedSeatSegmentUtilization,
            old?.reservedSeatSegmentUtilization ?? null,
          ),
          sampleSize: line.operatedTrips,
          evidenceStrength: evidenceStrength(
            line.operatedTrips,
            Boolean(old?.operatedTrips),
            policy,
          ),
          evidenceMetricKeys: [keys.utilisation, keys.unserved],
          period,
        }),
      );
    }

    const reliabilityChange = rateChange(
      line.onTimeDepartureRate,
      old?.onTimeDepartureRate ?? null,
    );
    if (
      line.actualDepartureSamples >= policy.minimumOperationalSample &&
      old &&
      old.actualDepartureSamples >= policy.minimumOperationalSample &&
      reliabilityChange !== null &&
      Math.abs(reliabilityChange) >= policy.materialPercentagePointChange
    ) {
      const improved = reliabilityChange > 0;
      signals.push(
        makeSignal({
          type: improved
            ? "RELIABILITY_IMPROVEMENT"
            : "RELIABILITY_DETERIORATION",
          severity: improved ? "POSITIVE" : reliabilityChange <= -20 ? "HIGH" : "MEDIUM",
          category: "RELIABILITY",
          scope: { lineId: line.lineId, lineCode: line.lineCode },
          headline: `${line.lineCode} reliability ${improved ? "improved" : "deteriorated"}`,
          observation: `On-time departure changed by ${Math.abs(reliabilityChange)} percentage points versus the previous comparable period.`,
          deterministicInterpretation: improved
            ? "Measured departure reliability is moving in a positive direction."
            : "Measured departure reliability is moving below its recent comparison.",
          recommendedReview: improved
            ? "Confirm whether the improvement repeats before changing the timetable."
            : "Review the affected departure windows and operational records.",
          recommendationLevel: improved ? "OBSERVE" : "REVIEW",
          observedValue: line.onTimeDepartureRate,
          comparisonValue: old.onTimeDepartureRate,
          change: reliabilityChange,
          sampleSize: line.actualDepartureSamples,
          evidenceStrength: evidenceStrength(line.actualDepartureSamples, true, policy),
          evidenceMetricKeys: [keys.onTime],
          period,
        }),
      );
    } else if (
      line.actualDepartureSamples >= policy.minimumOperationalSample &&
      line.onTimeDepartureRate !== null &&
      line.onTimeDepartureRate < policy.reliabilityTargetPercent
    ) {
      signals.push(
        makeSignal({
          type: "RECURRING_LATE_DEPARTURES",
          severity: line.onTimeDepartureRate < 60 ? "HIGH" : "WATCH",
          category: "RELIABILITY",
          scope: { lineId: line.lineId, lineCode: line.lineCode },
          headline: `${line.lineCode} recurring late departures`,
          observation: `${line.onTimeDepartureRate}% of ${line.actualDepartureSamples} measured departures met the five-minute tolerance.`,
          deterministicInterpretation:
            "The measured sample is below the configured reliability target.",
          recommendedReview: "Review origin dispatch and timetable allowance evidence.",
          recommendationLevel: "REVIEW",
          observedValue: line.onTimeDepartureRate,
          comparisonValue: old?.onTimeDepartureRate ?? null,
          change: reliabilityChange,
          sampleSize: line.actualDepartureSamples,
          evidenceStrength: evidenceStrength(
            line.actualDepartureSamples,
            Boolean(old?.actualDepartureSamples),
            policy,
          ),
          evidenceMetricKeys: [keys.onTime],
          period,
        }),
      );
    }

    if (
      old &&
      line.operatedTrips >= policy.minimumOperationalSample &&
      old.operatedTrips >= policy.minimumOperationalSample
    ) {
      const boardedChange = demandChangePercent(
        line.boardedPassengers,
        old.boardedPassengers,
      );
      if (
        boardedChange !== null &&
        Math.abs(boardedChange) >= policy.materialDemandChangePercent
      ) {
        signals.push(
          makeSignal({
            type: "DEMAND_SHIFT",
            severity: "WATCH",
            category: "DEMAND",
            scope: { lineId: line.lineId, lineCode: line.lineCode },
            headline: `${line.lineCode} demand shifted`,
            observation: `Boarded ridership changed by ${Math.abs(boardedChange)}% versus the previous comparable period.`,
            deterministicInterpretation:
              "Observed ridership has moved materially between comparable windows.",
            recommendedReview: "Review time-bucket and direction evidence before reallocating service.",
            recommendationLevel: "OBSERVE",
            observedValue: line.boardedPassengers,
            comparisonValue: old.boardedPassengers,
            change: boardedChange,
            sampleSize: line.operatedTrips,
            evidenceStrength: evidenceStrength(line.operatedTrips, true, policy),
            evidenceMetricKeys: [keys.boarded],
            period,
          }),
        );
      }
      const unservedChange = line.unservedDemand - old.unservedDemand;
      if (unservedChange >= policy.unservedDemandSpikeCount) {
        signals.push(
          makeSignal({
            type: "UNSERVED_DEMAND_SPIKE",
            severity: "HIGH",
            category: "CAPACITY",
            scope: { lineId: line.lineId, lineCode: line.lineCode },
            headline: `${line.lineCode} unserved demand increased`,
            observation: `${unservedChange} more journeys were unserved than in the previous comparable period.`,
            deterministicInterpretation:
              "Finalized demand failures increased and warrant capacity review.",
            recommendedReview: "Inspect the OD and time buckets where demand was unserved.",
            recommendationLevel: "CONSIDER",
            observedValue: line.unservedDemand,
            comparisonValue: old.unservedDemand,
            change: unservedChange,
            sampleSize: line.operatedTrips,
            evidenceStrength: evidenceStrength(line.operatedTrips, true, policy),
            evidenceMetricKeys: [keys.unserved],
            period,
          }),
        );
      }
    }
  }

  if (
    current.overview.eligibleBookingOutcomes >= policy.highEvidenceSample &&
    current.overview.noShowRate !== null &&
    current.overview.noShowRate >= policy.noShowWatchPercent
  ) {
    signals.push(
      makeSignal({
        type: "HIGH_NO_SHOW_RATE",
        severity: current.overview.noShowRate >= 20 ? "HIGH" : "WATCH",
        category: "PASSENGER_BEHAVIOUR",
        scope: {},
        headline: "Reservation no-show rate requires review",
        observation: `${current.overview.noShowRate}% across ${current.overview.eligibleBookingOutcomes} finalized attendance outcomes.`,
        deterministicInterpretation:
          "Unused reservations can reduce effective capacity available to other students.",
        recommendedReview: "Review reminder timing and existing credit-policy outcomes.",
        recommendationLevel: "REVIEW",
        observedValue: current.overview.noShowRate,
        comparisonValue: previous.overview.noShowRate,
        change: rateChange(current.overview.noShowRate, previous.overview.noShowRate),
        sampleSize: current.overview.eligibleBookingOutcomes,
        evidenceStrength: evidenceStrength(
          current.overview.eligibleBookingOutcomes,
          previous.overview.eligibleBookingOutcomes > 0,
          policy,
        ),
        evidenceMetricKeys: ["network.noShowRate"],
        period,
      }),
    );
  }

  for (const bus of fleet) {
    const workloadKey = addEvidence(evidence, {
      key: `fleet.${bus.busId}.workloadSharePercent`,
      label: `${bus.plateNumber} operated workload share`,
      value: bus.workloadSharePercent,
      unit: "PERCENT",
      sampleSize: current.overview.operatedTrips,
    });
    if (
      current.overview.operatedTrips >= policy.highEvidenceSample &&
      bus.workloadSharePercent !== null &&
      bus.workloadSharePercent >= policy.highFleetConcentrationPercent
    ) {
      signals.push(
        makeSignal({
          type: "HIGH_FLEET_CONCENTRATION",
          severity: "WATCH",
          category: "FLEET",
          scope: { busId: bus.busId, plateNumber: bus.plateNumber },
          headline: `${bus.plateNumber} carries concentrated workload`,
          observation: `${bus.workloadSharePercent}% of operated Trips used this Bus.`,
          deterministicInterpretation:
            "Service workload is concentrated on one physical vehicle in this period.",
          recommendedReview: "Review whether assignments can be balanced without breaking continuity.",
          recommendationLevel: "REVIEW",
          observedValue: bus.workloadSharePercent,
          comparisonValue: null,
          change: null,
          sampleSize: current.overview.operatedTrips,
          evidenceStrength: evidenceStrength(current.overview.operatedTrips, false, policy),
          evidenceMetricKeys: [workloadKey],
          period,
        }),
      );
    } else if (
      !current.filters.lineId &&
      !current.filters.direction &&
      current.overview.operatedTrips >= policy.highEvidenceSample &&
      bus.operatedTrips === 0
    ) {
      signals.push(
        makeSignal({
          type: "LOW_FLEET_UTILISATION",
          severity: "INFO",
          category: "FLEET",
          scope: { busId: bus.busId, plateNumber: bus.plateNumber },
          headline: `${bus.plateNumber} was not used`,
          observation: `No operated Trips were recorded for this Bus while the network operated ${current.overview.operatedTrips}.`,
          deterministicInterpretation:
            "The vehicle appears underused in this selected period; maintenance status may explain it.",
          recommendedReview: "Check vehicle availability before rebalancing assignments.",
          recommendationLevel: "OBSERVE",
          observedValue: 0,
          comparisonValue: null,
          change: null,
          sampleSize: current.overview.operatedTrips,
          evidenceStrength: evidenceStrength(current.overview.operatedTrips, false, policy),
          evidenceMetricKeys: [workloadKey],
          period,
        }),
      );
    }
    if (bus.turnaroundAdvisories > 0 || bus.deadheadAdvisories > 0) {
      const deadhead = bus.deadheadAdvisories > 0;
      const key = addEvidence(evidence, {
        key: `fleet.${bus.busId}.${deadhead ? "deadheadAdvisories" : "turnaroundAdvisories"}`,
        label: `${bus.plateNumber} ${deadhead ? "deadhead" : "turnaround"} advisories`,
        value: deadhead ? bus.deadheadAdvisories : bus.turnaroundAdvisories,
        unit: "COUNT",
        sampleSize: bus.scheduledTrips,
      });
      signals.push(
        makeSignal({
          type: deadhead ? "DEADHEAD_RISK" : "TURNAROUND_RISK",
          severity: "WATCH",
          category: "FLEET",
          scope: { busId: bus.busId, plateNumber: bus.plateNumber },
          headline: `${bus.plateNumber} ${deadhead ? "repositioning" : "turnaround"} advisory`,
          observation: `${deadhead ? bus.deadheadAdvisories : bus.turnaroundAdvisories} adjacent assignment advisory records were detected.`,
          deterministicInterpretation: deadhead
            ? "Terminal changes require operational repositioning review; exact travel time is unavailable."
            : "At least one same-terminal layover is shorter than the configured minimum.",
          recommendedReview: "Open the timetable and inspect adjacent Trip evidence.",
          recommendationLevel: "REVIEW",
          observedValue: deadhead ? bus.deadheadAdvisories : bus.turnaroundAdvisories,
          comparisonValue: null,
          change: null,
          sampleSize: bus.scheduledTrips,
          evidenceStrength: evidenceStrength(bus.scheduledTrips, false, policy),
          evidenceMetricKeys: [key],
          period,
        }),
      );
    }
  }

  for (const trip of input.currentExceptionTrips) {
    const overdue =
      trip.status === "NOT_STARTED" && trip.departureTime.getTime() < input.now.getTime();
    const nearWindow =
      trip.departureTime.getTime() <=
      input.now.getTime() + productPolicy.boardingOpenLeadMs;
    const active = trip.status === "BOARDING" || trip.status === "DEPARTED";
    const exception = (
      type: AnalyticsSignal["type"],
      headline: string,
      observation: string,
      metric: EvidenceMetric,
      recommendation: string,
    ) => {
      const key = addEvidence(evidence, metric);
      signals.push(
        makeSignal({
          type,
          severity: type === "OVERDUE_UNSTARTED_TRIP" ? "HIGH" : "MEDIUM",
          category: "CURRENT_OPERATION",
          scope: {
            tripId: trip.id,
            lineId: trip.route.lineId,
            lineCode: trip.route.line.code,
            direction: trip.route.direction,
            busId: trip.busId,
            plateNumber: trip.bus.plateNumber,
          },
          headline,
          observation,
          deterministicInterpretation:
            "This is a current operational exception and is not mixed into historical KPI denominators.",
          recommendedReview: recommendation,
          recommendationLevel: "IMMEDIATE_ATTENTION",
          observedValue: metric.value,
          comparisonValue: null,
          change: null,
          sampleSize: 1,
          evidenceStrength: "HIGH",
          evidenceMetricKeys: [key],
          period,
        }),
      );
    };
    if (overdue) {
      const overdueMinutes = Math.floor(
        (input.now.getTime() - trip.departureTime.getTime()) / 60_000,
      );
      exception(
        "OVERDUE_UNSTARTED_TRIP",
        `${trip.route.line.code} Trip is overdue and not started`,
        `Scheduled departure passed ${overdueMinutes} minutes ago without operational progress.`,
        {
          key: `trip.${trip.id}.overdueMinutes`,
          label: "Minutes past scheduled departure",
          value: overdueMinutes,
          unit: "MINUTES",
          sampleSize: 1,
        },
        "Confirm Driver and vehicle readiness for this Trip.",
      );
    }
    if (!trip.driverId && nearWindow && ["NOT_STARTED", "BOARDING"].includes(trip.status)) {
      exception(
        "TRIP_WITHOUT_DRIVER",
        `${trip.route.line.code} Trip has no assigned Driver`,
        "The Trip is within its boarding window or overdue without a Driver assignment.",
        {
          key: `trip.${trip.id}.driverAssigned`,
          label: "Driver assigned",
          value: 0,
          unit: "COUNT",
          sampleSize: 1,
        },
        "Assign an available Driver or review whether the Trip should operate.",
      );
    }
    if (active) {
      const sample = trip.locationSamples[0];
      const ageMinutes = sample
        ? Math.floor((input.now.getTime() - sample.recordedAt.getTime()) / 60_000)
        : null;
      if (
        !sample ||
        input.now.getTime() - sample.recordedAt.getTime() >
          productPolicy.trafficEtaMaxLocationAgeMs
      ) {
        exception(
          "STALE_TELEMETRY",
          `${trip.route.line.code} live telemetry is stale`,
          sample
            ? `The newest simulated GPS sample is ${ageMinutes} minutes old.`
            : "No simulated GPS sample is available for this active Trip.",
          {
            key: `trip.${trip.id}.telemetryAgeMinutes`,
            label: "Telemetry age",
            value: ageMinutes,
            unit: "MINUTES",
            sampleSize: 1,
          },
          "Check the simulator or location-ingestion health; do not infer the Bus position.",
        );
      }
    }
    if (
      !["ARRIVED", "CANCELLED"].includes(trip.status) &&
      trip.delayMinutes >= policy.significantExpectedDelayMinutes
    ) {
      exception(
        "SIGNIFICANT_EXPECTED_DELAY",
        `${trip.route.line.code} has a significant expected delay`,
        `Operations reported an expected delay of ${trip.delayMinutes} minutes.`,
        {
          key: `trip.${trip.id}.expectedDelayMinutes`,
          label: "Reported expected delay",
          value: trip.delayMinutes,
          unit: "MINUTES",
          sampleSize: 1,
        },
        "Review passenger communication and current operational progress.",
      );
    }
  }

  const activeByDriver = new Map<string, RawTrip[]>();
  for (const trip of input.currentExceptionTrips) {
    if (!trip.driverId || !["BOARDING", "DEPARTED"].includes(trip.status)) continue;
    const assigned = activeByDriver.get(trip.driverId) ?? [];
    assigned.push(trip);
    activeByDriver.set(trip.driverId, assigned);
  }
  for (const activeTrips of activeByDriver.values()) {
    if (activeTrips.length < 2) continue;
    const first = activeTrips[0]!;
    const key = addEvidence(evidence, {
      key: `trip.${first.id}.activeDriverTripCount`,
      label: "Simultaneous active Trips assigned to one Driver",
      value: activeTrips.length,
      unit: "COUNT",
      sampleSize: activeTrips.length,
    });
    const scope = {
      tripId: first.id,
      lineId: first.route.lineId,
      lineCode: first.route.line.code,
      direction: first.route.direction,
    };
    signals.push(
      makeSignal({
        type: "ACTIVE_DRIVER_CONFLICT",
        severity: "HIGH",
        category: "CURRENT_OPERATION",
        scope,
        headline: "One Driver has multiple active Trips",
        observation: `${activeTrips.length} active Trips currently share the same Driver assignment.`,
        deterministicInterpretation:
          "This is an operational state conflict, independent of historical analytics.",
        recommendedReview: "Resolve the active Driver assignment conflict immediately.",
        recommendationLevel: "IMMEDIATE_ATTENTION",
        observedValue: activeTrips.length,
        comparisonValue: null,
        change: null,
        sampleSize: activeTrips.length,
        evidenceStrength: "HIGH",
        evidenceMetricKeys: [key],
        period,
      }),
    );
  }

  const missingActualDepartureCount = Math.max(
    0,
    current.overview.operatedTrips - current.overview.actualDepartureSamples,
  );
  if (missingActualDepartureCount > 0) {
    const key = addEvidence(evidence, {
      key: "dataQuality.missingActualDepartureCount",
      label: "Operated Trips without origin actual departure",
      value: missingActualDepartureCount,
      unit: "COUNT",
      sampleSize: current.overview.operatedTrips,
    });
    signals.push(
      makeSignal({
        type: "DATA_QUALITY_WARNING",
        severity: "INFO",
        category: "DATA_QUALITY",
        scope: {},
        headline: "Actual departure evidence is incomplete",
        observation: `${missingActualDepartureCount} operated Trips lack an origin actual-departure timestamp.`,
        deterministicInterpretation:
          "Reliability metrics exclude these Trips rather than treating missing timing as on-time or late.",
        recommendedReview: "Review operational progress capture completeness.",
        recommendationLevel: "OBSERVE",
        observedValue: missingActualDepartureCount,
        comparisonValue: null,
        change: null,
        sampleSize: current.overview.operatedTrips,
        evidenceStrength: "HIGH",
        evidenceMetricKeys: [key],
        period,
      }),
    );
  }
  if (current.overview.operatedTrips < policy.minimumOperationalSample) {
    signals.push(
      makeSignal({
        type: "INSUFFICIENT_SAMPLE",
        severity: "INFO",
        category: "DATA_QUALITY",
        scope: {},
        headline: "Operational sample is still forming",
        observation: `${current.overview.operatedTrips} operated Trips are available in the selected period.`,
        deterministicInterpretation:
          "The sample is too small to establish a recurring network trend.",
        recommendedReview: "Continue monitoring and avoid broad timetable changes from this sample.",
        recommendationLevel: "OBSERVE",
        observedValue: current.overview.operatedTrips,
        comparisonValue: previous.overview.operatedTrips,
        change: countChange(
          current.overview.operatedTrips,
          previous.overview.operatedTrips,
        ),
        sampleSize: current.overview.operatedTrips,
        evidenceStrength: "LOW",
        evidenceMetricKeys: ["network.boardedPassengers"],
        period,
      }),
    );
  }

  signals.sort(
    (left, right) =>
      severityPriority[right.severity] - severityPriority[left.severity] ||
      (exceptionPriority[right.type] ?? 0) - (exceptionPriority[left.type] ?? 0) ||
      strengthPriority[right.evidenceStrength] - strengthPriority[left.evidenceStrength] ||
      right.sampleSize - left.sampleSize ||
      left.id.localeCompare(right.id),
  );

  const limitations = [
    ...(current.overview.operatedTrips < policy.minimumOperationalSample
      ? ["Fewer than three operated Trips are available in the selected period."]
      : []),
    ...(missingActualDepartureCount > 0
      ? [`${missingActualDepartureCount} operated Trips lack origin actual-departure evidence.`]
      : []),
    ...(!comparisonAvailable
      ? ["No operated Trips are available in the previous comparable period."]
      : []),
    ...(originDestination.length === 0
      ? ["No boarded or finalized-unserved OD journeys are available."]
      : []),
    "Traffic attribution is unavailable unless a separately evidenced traffic estimate exists.",
    "Location records are simulated prototype telemetry, not official TAR UMT GPS.",
  ];

  const snapshotWithoutFingerprint = {
    period: current.range,
    comparisonPeriod: {
      from: previous.range.from,
      to: previous.range.to,
    },
    generatedAt: input.now.toISOString(),
    eligibleTripCount: current.overview.operatedTrips,
    dataQuality: {
      ...current.dataQuality,
      missingActualDepartureCount,
      comparisonAvailable,
      limitations,
    },
    network: {
      current: current.overview,
      previous: previous.overview,
      changes: {
        boardedPassengers: countChange(
          current.overview.boardedPassengers,
          previous.overview.boardedPassengers,
        ),
        reservedSeatSegmentUtilization: rateChange(
          current.overview.reservedSeatSegmentUtilization,
          previous.overview.reservedSeatSegmentUtilization,
        ),
        onTimeDepartureRate: rateChange(
          current.overview.onTimeDepartureRate,
          previous.overview.onTimeDepartureRate,
        ),
        averageDepartureDelayMinutes: rateChange(
          current.overview.averageDepartureDelayMinutes,
          previous.overview.averageDepartureDelayMinutes,
        ),
        unservedDemand: countChange(
          current.overview.unservedDemand,
          previous.overview.unservedDemand,
        ),
      },
    },
    serviceLines: current.linePerformance,
    previousServiceLines: previous.linePerformance,
    timeBuckets,
    originDestination,
    segmentLoads,
    reliability: current.reliability,
    demand: current.demandPressure,
    fleet,
    passengerBehaviour: {
      noShowRate: current.overview.noShowRate,
      eligibleBookingOutcomes: current.overview.eligibleBookingOutcomes,
      waitlistPromotionRate: current.overview.promotionRate,
      finalizedWaitlistOutcomes: current.overview.waitlistFinalizedOutcomes,
      boardedPassengers: current.overview.boardedPassengers,
      unservedDemand: current.overview.unservedDemand,
    },
    tripEvidence,
    evidence,
    signals,
    focusSignalId: signals[0]?.id ?? null,
  };
  return {
    ...snapshotWithoutFingerprint,
    fingerprint: analyticsFingerprint(snapshotWithoutFingerprint),
  };
}

export function deterministicExecutiveInsights(snapshot: AnalyticsSnapshot) {
  return snapshot.signals.slice(0, 5).map((signal) => ({
    signalId: signal.id,
    severity: signal.severity,
    category: signal.category,
    headline: signal.headline,
    observation: signal.observation,
    interpretation: signal.deterministicInterpretation,
    evidenceMetricKeys: [...signal.evidenceMetricKeys],
    recommendedReview: signal.recommendedReview,
    confidence: signal.evidenceStrength,
    limitations:
      signal.evidenceStrength === "LOW"
        ? ["Current sample is too small to establish a recurring trend."]
        : [],
  }));
}
