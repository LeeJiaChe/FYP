import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateCumulativeLegEtas,
  calculateScheduleFallbackEtas,
  calculateScheduleVarianceMinutes,
  calculateTrafficImpactMinutes,
  DEFAULT_TRAFFIC_ETA_CACHE_MS,
  DEFAULT_TRAFFIC_ETA_FAILURE_CACHE_MS,
  DEFAULT_TRAFFIC_ETA_MAX_LOCATION_AGE_MS,
  DEFAULT_TRAFFIC_ETA_TIMEOUT_MS,
  parseGoogleDurationSeconds,
  resolveRemainingStops,
  type OperationalTripStopSnapshot,
} from "../../../src/features/eta/domain/eta-policy";

describe("ETA domain policy - constants and duration parsing", () => {
  it("defines explicit policy constants with expected values", () => {
    assert.equal(DEFAULT_TRAFFIC_ETA_CACHE_MS, 45_000);
    assert.equal(DEFAULT_TRAFFIC_ETA_FAILURE_CACHE_MS, 15_000);
    assert.equal(DEFAULT_TRAFFIC_ETA_TIMEOUT_MS, 3_000);
    assert.equal(DEFAULT_TRAFFIC_ETA_MAX_LOCATION_AGE_MS, 60_000);
  });

  it("parses Google Routes API duration strings into seconds", () => {
    assert.equal(parseGoogleDurationSeconds("120s"), 120);
    assert.equal(parseGoogleDurationSeconds("120.5s"), 120.5);
    assert.equal(parseGoogleDurationSeconds("0s"), 0);
    assert.equal(parseGoogleDurationSeconds("0.25s"), 0.25);
    assert.equal(parseGoogleDurationSeconds("3600s"), 3600);
  });

  it("rejects malformed or negative duration strings", () => {
    assert.throws(() => parseGoogleDurationSeconds("120"), /Invalid Google duration/);
    assert.throws(() => parseGoogleDurationSeconds("s"), /Invalid Google duration/);
    assert.throws(() => parseGoogleDurationSeconds("-10s"), /Invalid Google duration/);
    assert.throws(() => parseGoogleDurationSeconds("abc"), /Invalid Google duration/);
    assert.throws(() => parseGoogleDurationSeconds(""), /Invalid Google duration/);
  });
});

describe("ETA domain policy - traffic impact and schedule variance", () => {
  it("calculates traffic impact minutes as max(0, traffic - static) in minutes", () => {
    // 900s traffic vs 600s static = 300s = 5 minutes
    assert.equal(calculateTrafficImpactMinutes(900, 600), 5);

    // Static equal to traffic = 0 min impact
    assert.equal(calculateTrafficImpactMinutes(600, 600), 0);

    // Static greater than traffic (unexpected faster than normal) clamps to 0
    assert.equal(calculateTrafficImpactMinutes(500, 600), 0);

    // Rounding: 90s difference = 1.5 min rounds to 2 min
    assert.equal(calculateTrafficImpactMinutes(690, 600), 2);
  });

  it("calculates schedule variance minutes relative to planned timetable arrival", () => {
    const planned = new Date("2026-09-04T10:10:00.000Z");

    // Estimated 10:16 vs planned 10:10 = +6 min variance (running late)
    const lateEstimated = new Date("2026-09-04T10:16:00.000Z");
    assert.equal(calculateScheduleVarianceMinutes(lateEstimated, planned), 6);

    // Estimated 10:08 vs planned 10:10 = -2 min variance (ahead of schedule)
    const earlyEstimated = new Date("2026-09-04T10:08:00.000Z");
    assert.equal(calculateScheduleVarianceMinutes(earlyEstimated, planned), -2);

    // Estimated exactly on time = 0 min variance
    assert.equal(calculateScheduleVarianceMinutes(planned, planned), 0);
  });
});

describe("ETA domain policy - remaining stops and cumulative legs", () => {
  const sampleStops: OperationalTripStopSnapshot[] = [
    {
      id: "stop-0",
      position: 0,
      stopCode: "TAR_GATE_7",
      stopName: "TAR UMT Gate 7",
      latitude: 3.215,
      longitude: 101.726,
      plannedArrival: new Date("2026-09-04T10:00:00.000Z"),
      actualArrival: new Date("2026-09-04T09:55:00.000Z"),
      actualDeparture: new Date("2026-09-04T10:02:00.000Z"),
      passedAt: null,
    },
    {
      id: "stop-1",
      position: 1,
      stopCode: "PV18",
      stopName: "PV18",
      latitude: 3.209,
      longitude: 101.712,
      plannedArrival: new Date("2026-09-04T10:10:00.000Z"),
      actualArrival: null,
      actualDeparture: null,
      passedAt: null,
    },
    {
      id: "stop-2",
      position: 2,
      stopCode: "TERATAI",
      stopName: "Teratai Residency",
      latitude: 3.207,
      longitude: 101.711,
      plannedArrival: new Date("2026-09-04T10:20:00.000Z"),
      actualArrival: null,
      actualDeparture: null,
      passedAt: null,
    },
    {
      id: "stop-3",
      position: 3,
      stopCode: "TERMINAL",
      stopName: "Terminal",
      latitude: 3.201,
      longitude: 101.717,
      plannedArrival: new Date("2026-09-04T10:30:00.000Z"),
      actualArrival: null,
      actualDeparture: null,
      passedAt: null,
    },
  ];

  it("determines remaining stops when bus has departed stop 0", () => {
    const { remainingStops, nextStop } = resolveRemainingStops("DEPARTED", sampleStops);

    // Stop 0 has departed, so remaining stops are 1, 2, 3 in authoritative order
    assert.equal(remainingStops.length, 3);
    assert.equal(remainingStops[0]!.id, "stop-1");
    assert.equal(remainingStops[1]!.id, "stop-2");
    assert.equal(remainingStops[2]!.id, "stop-3");
    assert.equal(nextStop?.id, "stop-1");
  });

  it("determines remaining stops when bus is boarding at stop 0", () => {
    const boardingStops = sampleStops.map((s, idx) =>
      idx === 0
        ? { ...s, actualArrival: new Date("2026-09-04T09:55:00Z"), actualDeparture: null }
        : s,
    );

    const { remainingStops, currentStop, nextStop } = resolveRemainingStops("BOARDING", boardingStops);

    // Bus is currently dwell/boarding at stop 0
    assert.equal(currentStop?.id, "stop-0");
    // Next stop to travel to is stop 1
    assert.equal(nextStop?.id, "stop-1");
    // Remaining stops to visit along the road are 1, 2, 3
    assert.equal(remainingStops.length, 3);
    assert.equal(remainingStops[0]!.id, "stop-1");
  });

  it("calculates cumulative leg ETAs from Google route legs", () => {
    const generatedAt = new Date("2026-09-04T10:04:00.000Z");
    const unpassedStops = sampleStops.slice(1); // stop-1, stop-2, stop-3

    // Leg 1 (current bus -> stop-1): 120s = 2 min
    // Leg 2 (stop-1 -> stop-2): 180s = 3 min (cumulative: 5 min)
    // Leg 3 (stop-2 -> stop-3): 60s = 1 min (cumulative: 6 min)
    const legs = [
      { durationSeconds: 120, staticDurationSeconds: 100, distanceMeters: 1000 },
      { durationSeconds: 180, staticDurationSeconds: 150, distanceMeters: 1500 },
      { durationSeconds: 60, staticDurationSeconds: 50, distanceMeters: 800 },
    ];

    const stopEtas = calculateCumulativeLegEtas({
      generatedAt,
      remainingStops: unpassedStops,
      legs,
    });

    assert.equal(stopEtas.length, 3);

    // Stop 1: 2 min away -> 10:04 + 2m = 10:06:00Z (planned 10:10 -> variance -4)
    assert.equal(stopEtas[0]!.stopCode, "PV18");
    assert.equal(stopEtas[0]!.minutesAway, 2);
    assert.equal(stopEtas[0]!.estimatedArrival, "2026-09-04T10:06:00.000Z");
    assert.equal(stopEtas[0]!.scheduleVarianceMinutes, -4);
    assert.equal(stopEtas[0]!.cumulativeDistanceMeters, 1000);

    // Stop 2: 2 + 3 = 5 min away -> 10:04 + 5m = 10:09:00Z (planned 10:20 -> variance -11)
    assert.equal(stopEtas[1]!.stopCode, "TERATAI");
    assert.equal(stopEtas[1]!.minutesAway, 5);
    assert.equal(stopEtas[1]!.estimatedArrival, "2026-09-04T10:09:00.000Z");
    assert.equal(stopEtas[1]!.scheduleVarianceMinutes, -11);
    assert.equal(stopEtas[1]!.cumulativeDistanceMeters, 2500);

    // Stop 3: 2 + 3 + 1 = 6 min away -> 10:04 + 6m = 10:10:00Z (planned 10:30 -> variance -20)
    assert.equal(stopEtas[2]!.stopCode, "TERMINAL");
    assert.equal(stopEtas[2]!.minutesAway, 6);
    assert.equal(stopEtas[2]!.estimatedArrival, "2026-09-04T10:10:00.000Z");
    assert.equal(stopEtas[2]!.scheduleVarianceMinutes, -20);
    assert.equal(stopEtas[2]!.cumulativeDistanceMeters, 3300);
  });

  it("calculates schedule fallback ETAs using timetable and trip delay", () => {
    const now = new Date("2026-09-04T10:00:00.000Z");
    const delayMinutes = 5;

    const unpassedStops = sampleStops.slice(1); // stop-1 (10:10), stop-2 (10:20), stop-3 (10:30)

    const fallbackEtas = calculateScheduleFallbackEtas({
      now,
      remainingStops: unpassedStops,
      delayMinutes,
    });

    assert.equal(fallbackEtas.length, 3);

    // Stop 1: planned 10:10 + 5m delay = 10:15. Minutes away from 10:00 = 15m.
    assert.equal(fallbackEtas[0]!.stopCode, "PV18");
    assert.equal(fallbackEtas[0]!.estimatedArrival, "2026-09-04T10:15:00.000Z");
    assert.equal(fallbackEtas[0]!.minutesAway, 15);
    assert.equal(fallbackEtas[0]!.scheduleVarianceMinutes, 5);

    // Stop 2: planned 10:20 + 5m delay = 10:25. Minutes away from 10:00 = 25m.
    assert.equal(fallbackEtas[1]!.stopCode, "TERATAI");
    assert.equal(fallbackEtas[1]!.estimatedArrival, "2026-09-04T10:25:00.000Z");
    assert.equal(fallbackEtas[1]!.minutesAway, 25);
    assert.equal(fallbackEtas[1]!.scheduleVarianceMinutes, 5);
  });
});
