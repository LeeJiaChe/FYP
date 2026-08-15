import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCoordinate,
  isRecordedAtReasonable,
  isTelemetryTripEligible,
  locationAgeMs,
  locationRetentionCutoff,
} from "../../../src/features/location/domain/location-policy";
import { interpolateCoordinate } from "../../../src/features/location/domain/simulator";

describe("location telemetry policies", () => {
  it("validates coordinates, lifecycle eligibility, freshness, and retention", () => {
    assert.doesNotThrow(() => assertCoordinate(-90, 180));
    assert.throws(() => assertCoordinate(90.1, 0));
    assert.throws(() => assertCoordinate(0, -180.1));
    assert.equal(isTelemetryTripEligible("BOARDING"), true);
    assert.equal(isTelemetryTripEligible("DEPARTED"), true);
    assert.equal(isTelemetryTripEligible("ARRIVED"), false);
    const now = new Date("2026-08-15T12:00:00.000Z");
    assert.equal(isRecordedAtReasonable(new Date("2026-08-15T12:01:00.000Z"), now), true);
    assert.equal(isRecordedAtReasonable(new Date("2026-08-15T12:03:00.000Z"), now), false);
    assert.equal(locationAgeMs(new Date("2026-08-15T11:59:30.000Z"), now), 30_000);
    assert.equal(locationRetentionCutoff(now, 7 * 86_400_000).toISOString(), "2026-08-08T12:00:00.000Z");
  });

  it("simulates geographic coordinates without schedule-derived UI state", () => {
    assert.deepEqual(
      interpolateCoordinate({ latitude: 3.2, longitude: 101.7 }, { latitude: 3.3, longitude: 101.8 }, 0.5),
      { latitude: 3.25, longitude: 101.75 },
    );
  });
});

