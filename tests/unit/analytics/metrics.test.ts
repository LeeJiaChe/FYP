import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  averageOrNull,
  buildOperationalInsights,
  departureDelayMinutes,
  isAdministrativeCleanupReason,
  isDepartureOnTime,
  noShowPercent,
  percentageOrNull,
  utilizationPercent,
} from "../../../src/features/analytics/domain/metrics";

describe("journey-aware analytics formulas and domain metrics", () => {
  it("uses segment capacity denominators and handles zero standing capacity", () => {
    assert.equal(utilizationPercent(45, 30 * 3), 50);
    assert.equal(utilizationPercent(3, 0), 0);
    assert.equal(noShowPercent(2, 8), 25);
  });

  it("handles percentageOrNull zero and valid denominators (Requirements A, B, F, G)", () => {
    assert.equal(percentageOrNull(0, 0), null);
    assert.equal(percentageOrNull(10, 0), null);
    assert.equal(percentageOrNull(10, 20), 50);
    assert.equal(percentageOrNull(2, 20), 10);
    assert.equal(percentageOrNull(0, 20), 0);
  });

  it("handles averageOrNull zero and valid counts", () => {
    assert.equal(averageOrNull(0, 0), null);
    assert.equal(averageOrNull(15, 3), 5);
    assert.equal(averageOrNull(14, 3), 4.7);
  });

  it("evaluates on-time departures with 5-minute tolerance (Requirements C, D)", () => {
    const planned = new Date("2026-09-02T08:00:00.000Z");
    const onTimeActual = new Date("2026-09-02T08:04:00.000Z");
    const lateActual = new Date("2026-09-02T08:06:00.000Z");
    const exactToleranceActual = new Date("2026-09-02T08:05:00.000Z");

    assert.equal(isDepartureOnTime(planned, onTimeActual), true);
    assert.equal(isDepartureOnTime(planned, exactToleranceActual), true);
    assert.equal(isDepartureOnTime(planned, lateActual), false);
  });

  it("evaluates departure delays and ensures early departures yield 0 delay (Requirement E)", () => {
    const planned = new Date("2026-09-02T08:00:00.000Z");
    const earlyActual = new Date("2026-09-02T07:55:00.000Z");
    const lateActual = new Date("2026-09-02T08:12:00.000Z");

    assert.equal(departureDelayMinutes(planned, earlyActual), 0);
    assert.equal(departureDelayMinutes(planned, lateActual), 12);
  });

  it("identifies administrative prototype cleanup cancellation reasons", () => {
    assert.equal(
      isAdministrativeCleanupReason("Stale prototype schedule rollover after shared development migration"),
      true,
    );
    assert.equal(
      isAdministrativeCleanupReason("Stale prototype operational state cleanup after transit model deployment"),
      true,
    );
    assert.equal(isAdministrativeCleanupReason("Bus engine breakdown"), false);
    assert.equal(isAdministrativeCleanupReason(null), false);
  });

  describe("Rule-based operational insights", () => {
    it("flags capacity pressure only when sample size >= 3 AND utilization >= 80% AND unserved >= 1", () => {
      // 2 trips: insufficient sample
      const lowSample = buildOperationalInsights(
        [{
          lineCode: "TERATAI",
          lineName: "TAR UMT ↔ Teratai",
          operatedTrips: 2,
          reservedSeatSegmentUtilization: 85,
          unservedDemand: 3,
          actualDepartureSamples: 2,
          onTimeDepartureRate: 100,
          averageDepartureDelayMinutes: 0,
        }],
        { eligibleBookingOutcomes: 0, noShowRate: null, completedTripSamples: 5, totalLines: 1 },
      );
      assert.equal(lowSample.some((i) => i.type === "CAPACITY_PRESSURE"), false);

      // 3 trips + 85% + 2 unserved -> CAPACITY_PRESSURE
      const capacityPressure = buildOperationalInsights(
        [{
          lineCode: "TERATAI",
          lineName: "TAR UMT ↔ Teratai",
          operatedTrips: 3,
          reservedSeatSegmentUtilization: 85,
          unservedDemand: 2,
          actualDepartureSamples: 3,
          onTimeDepartureRate: 100,
          averageDepartureDelayMinutes: 0,
        }],
        { eligibleBookingOutcomes: 0, noShowRate: null, completedTripSamples: 5, totalLines: 1 },
      );
      const pressureInsight = capacityPressure.find((i) => i.type === "CAPACITY_PRESSURE");
      assert.ok(pressureInsight);
      assert.equal(pressureInsight.title, "Capacity Pressure on TERATAI");

      // 3 trips + 85% + 0 unserved -> NO capacity pressure
      const noUnserved = buildOperationalInsights(
        [{
          lineCode: "TERATAI",
          lineName: "TAR UMT ↔ Teratai",
          operatedTrips: 3,
          reservedSeatSegmentUtilization: 85,
          unservedDemand: 0,
          actualDepartureSamples: 3,
          onTimeDepartureRate: 100,
          averageDepartureDelayMinutes: 0,
        }],
        { eligibleBookingOutcomes: 0, noShowRate: null, completedTripSamples: 5, totalLines: 1 },
      );
      assert.equal(noUnserved.some((i) => i.type === "CAPACITY_PRESSURE"), false);
    });

    it("flags reliability risk only when departure samples >= 3 and on-time rate < 80%", () => {
      // 2 departures: insufficient sample
      const lowDepartureSample = buildOperationalInsights(
        [{
          lineCode: "PV_CORRIDOR",
          lineName: "TAR UMT ↔ PV Corridor",
          operatedTrips: 2,
          reservedSeatSegmentUtilization: 50,
          unservedDemand: 0,
          actualDepartureSamples: 2,
          onTimeDepartureRate: 50,
          averageDepartureDelayMinutes: 8,
        }],
        { eligibleBookingOutcomes: 0, noShowRate: null, completedTripSamples: 5, totalLines: 1 },
      );
      assert.equal(lowDepartureSample.some((i) => i.type === "RELIABILITY"), false);

      // 5 departures + 60% on-time -> RELIABILITY warning
      const reliabilityRisk = buildOperationalInsights(
        [{
          lineCode: "PV_CORRIDOR",
          lineName: "TAR UMT ↔ PV Corridor",
          operatedTrips: 5,
          reservedSeatSegmentUtilization: 50,
          unservedDemand: 0,
          actualDepartureSamples: 5,
          onTimeDepartureRate: 60,
          averageDepartureDelayMinutes: 7,
        }],
        { eligibleBookingOutcomes: 0, noShowRate: null, completedTripSamples: 5, totalLines: 1 },
      );
      const relInsight = reliabilityRisk.find((i) => i.type === "RELIABILITY");
      assert.ok(relInsight);
      assert.equal(relInsight.title, "Punctuality Risk on PV_CORRIDOR");
    });

    it("flags no-show warning only when eligible outcomes >= 10 and noShowRate >= 10%", () => {
      // 5 outcomes: insufficient sample
      const lowOutcomeSample = buildOperationalInsights(
        [],
        { eligibleBookingOutcomes: 5, noShowRate: 40, completedTripSamples: 5, totalLines: 1 },
      );
      assert.equal(lowOutcomeSample.some((i) => i.type === "NO_SHOW"), false);

      // 20 eligible + 15% no-show -> NO_SHOW warning
      const highNoShow = buildOperationalInsights(
        [],
        { eligibleBookingOutcomes: 20, noShowRate: 15, completedTripSamples: 5, totalLines: 1 },
      );
      const noShowInsight = highNoShow.find((i) => i.type === "NO_SHOW");
      assert.ok(noShowInsight);
      assert.equal(noShowInsight.title, "Elevated Reservation No-Show Rate");
    });

    it("returns insufficient data notice when completed trip samples < 3", () => {
      const sparse = buildOperationalInsights(
        [],
        { eligibleBookingOutcomes: 0, noShowRate: null, completedTripSamples: 1, totalLines: 5 },
      );
      assert.ok(sparse.some((i) => i.type === "INSUFFICIENT_DATA"));
    });
  });
});


