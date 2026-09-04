import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveStudentTrackingState } from "../../../src/features/trips/domain/student-tracking-eligibility";

describe("student Trip tracking eligibility", () => {
  const now = new Date("2026-09-04T01:00:00.000Z");

  it("admits future upcoming and active Trips", () => {
    assert.equal(resolveStudentTrackingState("NOT_STARTED", new Date(now.getTime() + 1), now), "UPCOMING");
    assert.equal(resolveStudentTrackingState("BOARDING", now, now), "LIVE");
    assert.equal(resolveStudentTrackingState("DEPARTED", now, now), "LIVE");
  });

  it("excludes terminal and stale unprogressed Trips", () => {
    assert.equal(resolveStudentTrackingState("ARRIVED", now, now), "UNAVAILABLE");
    assert.equal(resolveStudentTrackingState("CANCELLED", now, now), "UNAVAILABLE");
    assert.equal(resolveStudentTrackingState("NOT_STARTED", new Date(now.getTime() - 1), now), "UNAVAILABLE");
  });
});
