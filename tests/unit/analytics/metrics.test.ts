import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  averageOrNull,
  buildOperationalInsights,
  calculateFinalizedWaitlistPromotionRate,
  calculateMytPresetRange,
  departureDelayMinutes,
  getMytCalendarDate,
  isAdministrativeCleanupReason,
  isAdministrativeCleanupTrip,
  isAnalyticsCompletedTrip,
  isAnalyticsOperatedTrip,
  isDepartureOnTime,
  isReliabilityEligibleTrip,
  noShowPercent,
  parseMytDateStringToUtc,
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

  describe("Finalized waitlist promotion rate", () => {
    it("returns null when finalized waitlist outcomes is zero", () => {
      assert.equal(calculateFinalizedWaitlistPromotionRate(0, 0), null);
    });

    it("calculates correct percentage from promoted and expired outcomes", () => {
      assert.equal(calculateFinalizedWaitlistPromotionRate(3, 1), 75);
      assert.equal(calculateFinalizedWaitlistPromotionRate(1, 3), 25);
      assert.equal(calculateFinalizedWaitlistPromotionRate(4, 0), 100);
      assert.equal(calculateFinalizedWaitlistPromotionRate(0, 4), 0);
    });
  });

  describe("Centralized trip eligibility and administrative cleanup predicates", () => {
    it("identifies administrative prototype cleanup trips accurately", () => {
      const cleanupTrip = {
        status: "CANCELLED",
        statusHistory: [
          { toStatus: "CANCELLED", reason: "Stale prototype schedule rollover after shared development migration" },
        ],
      };
      assert.equal(isAdministrativeCleanupTrip(cleanupTrip), true);

      const realCancelledTrip = {
        status: "CANCELLED",
        statusHistory: [
          { toStatus: "CANCELLED", reason: "Driver medical emergency" },
        ],
      };
      assert.equal(isAdministrativeCleanupTrip(realCancelledTrip), false);

      const nonCancelledTrip = {
        status: "ARRIVED",
        statusHistory: [],
      };
      assert.equal(isAdministrativeCleanupTrip(nonCancelledTrip), false);
    });

    it("excludes administrative cleanup trips from operated and reliability eligibility", () => {
      const cleanupTripWithDeparture = {
        status: "CANCELLED",
        tripStops: [{ position: 0, actualDeparture: new Date("2026-08-25T10:00:00Z") }],
      };
      // When marked as admin cleanup, it must NOT be eligible
      assert.equal(isAnalyticsOperatedTrip(cleanupTripWithDeparture, true), false);
      assert.equal(isAnalyticsCompletedTrip(cleanupTripWithDeparture, true), false);
      assert.equal(isReliabilityEligibleTrip(cleanupTripWithDeparture, true), false);

      // A genuine operated trip is eligible
      const realOperatedTrip = {
        status: "ARRIVED",
        tripStops: [{ position: 0, actualDeparture: new Date("2026-09-03T10:00:00Z") }],
      };
      assert.equal(isAnalyticsOperatedTrip(realOperatedTrip, false), true);
      assert.equal(isAnalyticsCompletedTrip(realOperatedTrip, false), true);
      assert.equal(isReliabilityEligibleTrip(realOperatedTrip, false), true);
    });
  });

  describe("Malaysia Time (MYT UTC+8) deterministic date helpers", () => {
    it("formats calendar dates accurately across early morning, late evening, month and year boundaries", () => {
      // Early morning MYT: 2026-09-03 02:00 MYT is 2026-09-02 18:00 UTC
      const earlyMorningUtc = new Date("2026-09-02T18:00:00.000Z");
      assert.equal(getMytCalendarDate(earlyMorningUtc), "2026-09-03");

      // Late night MYT: 2026-09-03 23:30 MYT is 2026-09-03 15:30 UTC
      const lateNightUtc = new Date("2026-09-03T15:30:00.000Z");
      assert.equal(getMytCalendarDate(lateNightUtc), "2026-09-03");

      // Month rollover: 2026-09-01 00:30 MYT is 2026-08-31 16:30 UTC
      const monthStartUtc = new Date("2026-08-31T16:30:00.000Z");
      assert.equal(getMytCalendarDate(monthStartUtc), "2026-09-01");

      // Year rollover: 2027-01-01 01:00 MYT is 2026-12-31 17:00 UTC
      const yearStartUtc = new Date("2026-12-31T17:00:00.000Z");
      assert.equal(getMytCalendarDate(yearStartUtc), "2027-01-01");
    });

    it("parses MYT calendar date strings into precise UTC boundary instants", () => {
      // Start instant of 2026-09-03 in MYT (00:00:00+08:00) is 2026-09-02T16:00:00.000Z
      const startInstant = parseMytDateStringToUtc("2026-09-03", false);
      assert.equal(startInstant.toISOString(), "2026-09-02T16:00:00.000Z");

      // Exclusive end instant of 2026-09-03 (2026-09-04 00:00:00+08:00) is 2026-09-03T16:00:00.000Z
      const endExclusiveInstant = parseMytDateStringToUtc("2026-09-03", true);
      assert.equal(endExclusiveInstant.toISOString(), "2026-09-03T16:00:00.000Z");
    });

    it("strictly validates MYT calendar dates and rejects impossible dates", () => {
      // Valid dates
      assert.doesNotThrow(() => parseMytDateStringToUtc("2026-02-28"));
      assert.doesNotThrow(() => parseMytDateStringToUtc("2028-02-29")); // leap year
      assert.doesNotThrow(() => parseMytDateStringToUtc("2026-09-03"));
      assert.doesNotThrow(() => parseMytDateStringToUtc("2026-12-31"));

      // Invalid dates
      const invalidDates = [
        "2026-02-29", // non-leap year
        "2026-02-30",
        "2026-02-31",
        "2026-04-31", // April has 30 days
        "2026-13-01", // month 13
        "2026-00-01", // month 0
        "2026-09-00", // day 0
      ];

      for (const invalidDate of invalidDates) {
        assert.throws(
          () => parseMytDateStringToUtc(invalidDate),
          /Invalid MYT/,
          `Expected "${invalidDate}" to be rejected as an invalid MYT calendar date`,
        );
      }
    });

    it("calculates exact calendar day ranges for presets (7d, 30d, 90d)", () => {
      // Current instant is early morning MYT: 2026-09-03 02:00 MYT (2026-09-02T18:00:00Z)
      const mockNow = new Date("2026-09-02T18:00:00.000Z");

      // 1. Last 7 days: Today (Sep 3) + previous 6 days = Sep 3, 2, 1, Aug 31, 30, 29, 28 (7 days)
      const range7d = calculateMytPresetRange("7d", mockNow);
      assert.equal(range7d.toDateStr, "2026-09-03");
      assert.equal(range7d.fromDateStr, "2026-08-28");
      assert.equal(range7d.fromUtc.toISOString(), "2026-08-27T16:00:00.000Z"); // 2026-08-28 00:00 MYT
      assert.equal(range7d.toUtcExclusive.toISOString(), "2026-09-03T16:00:00.000Z"); // 2026-09-04 00:00 MYT

      // 2. Last 30 days: Today (Sep 3) + previous 29 days = Aug 5 to Sep 3 (30 days)
      const range30d = calculateMytPresetRange("30d", mockNow);
      assert.equal(range30d.toDateStr, "2026-09-03");
      assert.equal(range30d.fromDateStr, "2026-08-05");
      assert.equal(range30d.fromUtc.toISOString(), "2026-08-04T16:00:00.000Z");
      assert.equal(range30d.toUtcExclusive.toISOString(), "2026-09-03T16:00:00.000Z");

      // 3. Last 90 days: Today (Sep 3) + previous 89 days = Jun 6 to Sep 3 (90 days total: Jun=25d, Jul=31d, Aug=31d, Sep=3d)
      const range90d = calculateMytPresetRange("90d", mockNow);
      assert.equal(range90d.toDateStr, "2026-09-03");
      assert.equal(range90d.fromDateStr, "2026-06-06");
    });
  });
});
