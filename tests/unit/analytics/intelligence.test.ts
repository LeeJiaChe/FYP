import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { OperationsAnalyticsResponse } from "../../../src/features/analytics/contracts/analytics.schemas";
import {
  buildAnalyticsSnapshot,
} from "../../../src/features/analytics/domain/intelligence";
import {
  demandHeatMaximum,
  demandHeatValue,
  formatAnalyticsDelta,
} from "../../../src/features/analytics/domain/intelligence-presentation";
import type { OperationsAnalyticsRawData } from "../../../src/features/analytics/infrastructure/analytics.prisma.server";

const lineId = "11111111-1111-4111-8111-111111111111";
const busId = "22222222-2222-4222-8222-222222222222";

function analytics(input: {
  from?: string;
  to?: string;
  operatedTrips?: number;
  utilization?: number | null;
  unserved?: number;
  onTime?: number | null;
  departureSamples?: number;
  boarded?: number;
} = {}): OperationsAnalyticsResponse {
  const operatedTrips = input.operatedTrips ?? 5;
  const utilization = input.utilization === undefined ? 92 : input.utilization;
  const unserved = input.unserved ?? 6;
  const onTime = input.onTime === undefined ? 70 : input.onTime;
  const departureSamples = input.departureSamples ?? operatedTrips;
  const boarded = input.boarded ?? 20;
  const direction = {
    direction: "OUTBOUND" as const,
    scheduledTrips: operatedTrips,
    operatedTrips,
    completedTrips: operatedTrips,
    boardedPassengers: boarded,
    reservedSeatSegmentUtilization: utilization,
    eligibleBookingOutcomes: 12,
    noShowCount: 1,
    noShowRate: 8,
    actualDepartureSamples: departureSamples,
    onTimeDepartureRate: onTime,
    averageDepartureDelayMinutes: 7,
    unservedDemand: unserved,
    waitlistExpired: unserved,
    walkInsRejectedFull: 0,
    operationalCancellationCount: 0,
  };
  const emptyDirection = {
    ...direction,
    direction: "INBOUND" as const,
    scheduledTrips: 0,
    operatedTrips: 0,
    completedTrips: 0,
    boardedPassengers: 0,
    reservedSeatSegmentUtilization: null,
    eligibleBookingOutcomes: 0,
    noShowCount: 0,
    noShowRate: null,
    actualDepartureSamples: 0,
    onTimeDepartureRate: null,
    averageDepartureDelayMinutes: null,
    unservedDemand: 0,
    waitlistExpired: 0,
  };
  const overview = {
    boardedPassengers: boarded,
    reservedSeatSegmentUtilization: utilization,
    onTimeDepartureRate: onTime,
    averageDepartureDelayMinutes: departureSamples ? 7 : null,
    noShowRate: 8,
    unservedDemand: unserved,
    operationalCancellations: 0,
    totalScheduledTrips: operatedTrips,
    operatedTrips,
    completedTrips: operatedTrips,
    eligibleBookingOutcomes: 12,
    noShowCount: 1,
    actualDepartureSamples: departureSamples,
    waitlistExpired: unserved,
    walkInsRejectedFull: 0,
    currentWaitingCount: 0,
    waitlistEntries: unserved,
    waitlistPromoted: 2,
    waitlistFinalizedOutcomes: unserved + 2,
    promotionRate: 25,
  };
  return {
    range: {
      from: input.from ?? "2026-09-01T16:00:00.000Z",
      to: input.to ?? "2026-09-08T16:00:00.000Z",
      timezone: "Asia/Kuala_Lumpur",
    },
    filters: { lineId: null, direction: null },
    availableLines: [{ id: lineId, code: "TERATAI", name: "Teratai" }],
    overview,
    linePerformance: [{
      lineId,
      lineCode: "TERATAI",
      lineName: "Teratai",
      ...direction,
      directions: { outbound: direction, inbound: emptyDirection },
    }],
    hourlyRidership: [],
    demandPressure: [{
      lineId,
      lineCode: "TERATAI",
      lineName: "Teratai",
      unservedDemand: unserved,
      waitlistExpired: unserved,
      walkInsRejectedFull: 0,
      reservedSeatSegmentUtilization: utilization,
      operatedTrips,
      pressureFlag: utilization !== null && utilization >= 80 && unserved > 0,
    }],
    reliability: {
      overview: {
        onTimeDepartureRate: onTime,
        averageDepartureDelayMinutes: departureSamples ? 7 : null,
        maxDepartureDelayMinutes: departureSamples ? 12 : null,
        actualDepartureSamples: departureSamples,
        operationalCancellations: 0,
      },
      byLine: [{
        lineId,
        lineCode: "TERATAI",
        lineName: "Teratai",
        onTimeDepartureRate: onTime,
        averageDepartureDelayMinutes: departureSamples ? 7 : null,
        maxDepartureDelayMinutes: departureSamples ? 12 : null,
        actualDepartureSamples: departureSamples,
        operationalCancellations: 0,
      }],
    },
    fleetPerformance: [{
      busId,
      plateNumber: "TAR-1001",
      status: "ACTIVE",
      operatedTrips,
      completedTrips: operatedTrips,
      boardedPassengers: boarded,
      reservedSeatSegmentUtilization: utilization,
      actualServiceHours: 4,
      operationalCancellationCount: 0,
    }],
    insights: [],
    dataQuality: {
      excludedAdministrativeCleanupTrips: 0,
      completedTripSamples: operatedTrips,
      actualDepartureSamples: departureSamples,
      eligibleBookingOutcomes: 12,
      hasSufficientReliabilitySample: departureSamples >= 3,
      hasSufficientNoShowSample: true,
      prototypeData: true,
      timezone: "Asia/Kuala_Lumpur",
    },
  };
}

function trip(input: {
  id?: string;
  departure?: string;
  arrival?: string;
  status?: string;
  from?: { id: string; code: string; name: string };
  to?: { id: string; code: string; name: string };
  checkedIn?: boolean;
  waitExpired?: boolean;
  actualDeparture?: string | null;
} = {}): OperationsAnalyticsRawData["trips"][number] {
  const from = input.from ?? { id: "a", code: "STOP-A", name: "Stop A" };
  const to = input.to ?? { id: "b", code: "STOP-B", name: "Stop B" };
  const departure = new Date(input.departure ?? "2026-09-04T16:30:00.000Z");
  const arrival = new Date(input.arrival ?? "2026-09-04T17:00:00.000Z");
  const actual = input.actualDeparture === undefined
    ? new Date(departure.getTime() + 7 * 60_000)
    : input.actualDeparture
      ? new Date(input.actualDeparture)
      : null;
  const journeyStops = {
    boardingTripStop: { stopCode: from.code, stopName: from.name, position: 0 },
    dropOffTripStop: { stopCode: to.code, stopName: to.name, position: 1 },
  };
  return {
    id: input.id ?? "trip-1",
    routeId: "route-1",
    busId,
    driverId: "driver-1",
    departureTime: departure,
    estimatedArrivalTime: arrival,
    boardingDeadline: departure,
    seatedCapacity: 10,
    standingCapacity: 2,
    status: input.status ?? "ARRIVED",
    delayMinutes: 0,
    delayReason: null,
    route: {
      id: "route-1",
      lineId,
      direction: "OUTBOUND",
      name: "Teratai outbound",
      line: { id: lineId, code: "TERATAI", name: "Teratai" },
    },
    bus: { id: busId, plateNumber: "TAR-1001", status: "ACTIVE" },
    tripStops: [
      { id: "ts-1", stopId: from.id, position: 0, stopCode: from.code, stopName: from.name, plannedArrival: departure, plannedDeparture: departure, actualArrival: actual, actualDeparture: actual, passedAt: actual },
      { id: "ts-2", stopId: to.id, position: 1, stopCode: to.code, stopName: to.name, plannedArrival: arrival, plannedDeparture: arrival, actualArrival: arrival, actualDeparture: arrival, passedAt: arrival },
    ],
    tripSegments: [{ id: "segment-1", position: 0, reservedSeatSegmentsCount: 9, standingClaimsCount: 1 }],
    statusHistory: [],
    bookings: input.checkedIn === false ? [] : [{ id: "booking-1", status: "COMPLETED", checkedInAt: actual, actualAlightedAt: arrival, ...journeyStops }],
    waitlistEntries: input.waitExpired ? [{ id: "wait-1", status: "EXPIRED", promotedBookingId: null, ...journeyStops }] : [],
    walkInIntents: [],
    walkInJourneys: [],
    locationSamples: [],
    reservedSeatSegmentsCount: 9,
  };
}

function raw(trips: OperationsAnalyticsRawData["trips"]): OperationsAnalyticsRawData {
  return {
    lines: [{ id: lineId, code: "TERATAI", name: "Teratai", routes: [{ id: "route-1", direction: "OUTBOUND", name: "Teratai outbound" }] }],
    buses: [{ id: busId, plateNumber: "TAR-1001", status: "ACTIVE" }],
    trips,
  };
}

describe("Operations Intelligence snapshot and signals", () => {
  it("builds MYT time buckets and preserves external-to-external OD journeys", () => {
    const current = analytics();
    const snapshot = buildAnalyticsSnapshot({
      current,
      previous: analytics({ onTime: 90, utilization: 70, unserved: 0 }),
      currentRaw: raw([trip({ checkedIn: true, waitExpired: true })]),
      currentExceptionTrips: [],
      now: new Date("2026-09-08T00:00:00Z"),
    });
    assert.equal(snapshot.timeBuckets[0]?.bucket, "OVERNIGHT");
    assert.equal(snapshot.originDestination[0]?.boardingStopCode, "STOP-A");
    assert.equal(snapshot.originDestination[0]?.dropOffStopCode, "STOP-B");
    assert.equal(snapshot.originDestination[0]?.boardedJourneys, 1);
    assert.equal(snapshot.originDestination[0]?.unservedDemand, 1);
  });

  it("prioritizes severe capacity before deterioration and retains evidence strength", () => {
    const snapshot = buildAnalyticsSnapshot({
      current: analytics(),
      previous: analytics({ onTime: 90, utilization: 70, unserved: 0 }),
      currentRaw: raw([trip()]),
      currentExceptionTrips: [],
      now: new Date("2026-09-08T00:00:00Z"),
    });
    assert.equal(snapshot.signals[0]?.type, "CAPACITY_PRESSURE");
    assert.ok(snapshot.signals.some((signal) => signal.type === "RELIABILITY_DETERIORATION"));
    assert.equal(snapshot.signals[0]?.evidenceStrength, "MEDIUM");
  });

  it("detects positive reliability movement without claiming significance", () => {
    const snapshot = buildAnalyticsSnapshot({
      current: analytics({ utilization: 20, unserved: 0, onTime: 95 }),
      previous: analytics({ utilization: 20, unserved: 0, onTime: 70 }),
      currentRaw: raw([trip()]),
      currentExceptionTrips: [],
      now: new Date("2026-09-08T00:00:00Z"),
    });
    assert.ok(snapshot.signals.some((signal) => signal.type === "RELIABILITY_IMPROVEMENT" && signal.severity === "POSITIVE"));
  });

  it("separates overdue unstarted operations and missing timing from historical metrics", () => {
    const overdue = trip({
      status: "NOT_STARTED",
      departure: "2026-09-04T00:00:00Z",
      actualDeparture: null,
    });
    const snapshot = buildAnalyticsSnapshot({
      current: analytics({ operatedTrips: 2, departureSamples: 1, utilization: null, unserved: 0 }),
      previous: analytics({ operatedTrips: 0, departureSamples: 0, utilization: null, unserved: 0 }),
      currentRaw: raw([overdue]),
      currentExceptionTrips: [overdue],
      now: new Date("2026-09-04T00:20:00Z"),
    });
    assert.ok(snapshot.signals.some((signal) => signal.type === "OVERDUE_UNSTARTED_TRIP"));
    assert.ok(snapshot.signals.some((signal) => signal.type === "INSUFFICIENT_SAMPLE" && signal.evidenceStrength === "LOW"));
    assert.ok(snapshot.signals.some((signal) => signal.type === "DATA_QUALITY_WARNING"));
  });

  it("derives same-Bus turnaround advisories without a ServiceBlock", () => {
    const first = trip({ id: "trip-a", departure: "2026-09-04T00:00:00Z", arrival: "2026-09-04T00:30:00Z", from: { id: "a", code: "A", name: "A" }, to: { id: "b", code: "B", name: "B" } });
    const second = trip({ id: "trip-b", departure: "2026-09-04T00:35:00Z", arrival: "2026-09-04T01:00:00Z", from: { id: "b", code: "B", name: "B" }, to: { id: "c", code: "C", name: "C" } });
    const snapshot = buildAnalyticsSnapshot({
      current: analytics(),
      previous: analytics(),
      currentRaw: raw([first, second]),
      currentExceptionTrips: [],
      now: new Date("2026-09-08T00:00:00Z"),
    });
    assert.equal(snapshot.fleet[0]?.turnaroundAdvisories, 1);
    assert.ok(snapshot.signals.some((signal) => signal.type === "TURNAROUND_RISK"));
  });

  it("keeps overdue and stale clock counters out of material fingerprint identity", () => {
    const generatedAt20 = buildAnalyticsSnapshot({
      current: analytics(), previous: analytics(), currentRaw: raw([]),
      currentExceptionTrips: [], now: new Date("2026-09-04T00:20:00Z"),
    });
    const generatedAt21 = buildAnalyticsSnapshot({
      current: analytics(), previous: analytics(), currentRaw: raw([]),
      currentExceptionTrips: [], now: new Date("2026-09-04T00:21:00Z"),
    });
    assert.notEqual(generatedAt20.generatedAt, generatedAt21.generatedAt);
    assert.equal(generatedAt20.fingerprint, generatedAt21.fingerprint);

    const overdue = trip({
      status: "NOT_STARTED",
      departure: "2026-09-04T00:00:00Z",
      actualDeparture: null,
    });
    const overdueAt20 = buildAnalyticsSnapshot({
      current: analytics(), previous: analytics(), currentRaw: raw([]),
      currentExceptionTrips: [overdue], now: new Date("2026-09-04T00:20:00Z"),
    });
    const overdueAt21 = buildAnalyticsSnapshot({
      current: analytics(), previous: analytics(), currentRaw: raw([]),
      currentExceptionTrips: [overdue], now: new Date("2026-09-04T00:21:00Z"),
    });
    assert.equal(overdueAt20.fingerprint, overdueAt21.fingerprint);
    assert.notEqual(
      overdueAt20.signals.find((item) => item.type === "OVERDUE_UNSTARTED_TRIP")?.observedValue,
      overdueAt21.signals.find((item) => item.type === "OVERDUE_UNSTARTED_TRIP")?.observedValue,
    );

    const active = {
      ...trip({ status: "BOARDING", actualDeparture: null }),
      locationSamples: [{ recordedAt: new Date("2026-09-04T00:00:00Z") }],
    };
    const staleAt20 = buildAnalyticsSnapshot({
      current: analytics(), previous: analytics(), currentRaw: raw([]),
      currentExceptionTrips: [active], now: new Date("2026-09-04T00:20:00Z"),
    });
    const staleAt21 = buildAnalyticsSnapshot({
      current: analytics(), previous: analytics(), currentRaw: raw([]),
      currentExceptionTrips: [active], now: new Date("2026-09-04T00:21:00Z"),
    });
    assert.equal(staleAt20.fingerprint, staleAt21.fingerprint);
    assert.notEqual(
      staleAt20.signals.find((item) => item.type === "STALE_TELEMETRY")?.observedValue,
      staleAt21.signals.find((item) => item.type === "STALE_TELEMETRY")?.observedValue,
    );
  });

  it("changes material fingerprints for state, signal, metric, period, and scope changes", () => {
    const notStarted = trip({
      status: "NOT_STARTED",
      departure: "2026-09-04T00:00:00Z",
      actualDeparture: null,
    });
    const boarding = { ...notStarted, status: "BOARDING" };
    const baseInput = {
      current: analytics({ utilization: 20, unserved: 0 }),
      previous: analytics({ utilization: 20, unserved: 0 }),
      currentRaw: raw([]),
      now: new Date("2026-09-04T00:20:00Z"),
    };
    const base = buildAnalyticsSnapshot({ ...baseInput, currentExceptionTrips: [notStarted] });
    const statusChanged = buildAnalyticsSnapshot({ ...baseInput, currentExceptionTrips: [boarding] });
    const newHighSignal = buildAnalyticsSnapshot({
      ...baseInput,
      current: analytics({ utilization: 92, unserved: 6 }),
      currentExceptionTrips: [notStarted],
    });
    const metricChanged = buildAnalyticsSnapshot({
      ...baseInput,
      current: analytics({ utilization: 20, unserved: 0, boarded: 21 }),
      currentExceptionTrips: [notStarted],
    });
    const periodChanged = buildAnalyticsSnapshot({
      ...baseInput,
      current: analytics({
        from: "2026-09-02T16:00:00.000Z",
        to: "2026-09-09T16:00:00.000Z",
        utilization: 20,
        unserved: 0,
      }),
      currentExceptionTrips: [notStarted],
    });
    const scopedAnalytics = {
      ...baseInput.current,
      filters: { lineId, direction: null },
    };
    const scopeChanged = buildAnalyticsSnapshot({
      ...baseInput,
      current: scopedAnalytics,
      currentExceptionTrips: [notStarted],
    });
    assert.notEqual(base.fingerprint, statusChanged.fingerprint);
    assert.notEqual(base.fingerprint, newHighSignal.fingerprint);
    assert.notEqual(base.fingerprint, metricChanged.fingerprint);
    assert.notEqual(base.fingerprint, periodChanged.fingerprint);
    assert.notEqual(base.fingerprint, scopeChanged.fingerprint);
  });

  it("preserves null utilisation, numeric zero, and readable delta copy", () => {
    const row = {
      lineId,
      lineCode: "TERATAI",
      lineName: "Teratai",
      direction: "OUTBOUND" as const,
      bucket: "MORNING",
      label: "06:00–09:59",
      boardedPassengers: 0,
      reservedSeatSegmentUtilization: null,
      unservedDemand: 0,
      operatedTrips: 0,
    };
    assert.equal(demandHeatValue(row, "reservedSeatSegmentUtilization"), null);
    assert.equal(
      demandHeatValue({ ...row, reservedSeatSegmentUtilization: 0 }, "reservedSeatSegmentUtilization"),
      0,
    );
    assert.equal(demandHeatValue(row, "boardedPassengers"), 0);
    assert.equal(demandHeatMaximum([row], "reservedSeatSegmentUtilization"), 1);
    assert.equal(formatAnalyticsDelta(0, "pp"), "No change vs previous period");
    assert.equal(formatAnalyticsDelta(4, ""), "+4 vs previous period");
    assert.equal(formatAnalyticsDelta(-2, " min"), "-2 min vs previous period");
  });
});
