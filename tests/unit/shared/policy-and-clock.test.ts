import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createProductPolicy,
  productPolicy,
} from "../../../src/shared/config/policies";
import { fixedClock } from "../../../src/shared/time/clock";

describe("central product policy", () => {
  it("contains every approved default with explicit units", () => {
    assert.equal(productPolicy.bookingOpenLeadMs, 7 * 24 * 60 * 60 * 1_000);
    assert.equal(productPolicy.boardingOpenLeadMs, 15 * 60 * 1_000);
    assert.equal(productPolicy.normalBoardingCloseGraceMs, 5 * 60 * 1_000);
    assert.equal(productPolicy.qrTokenLifetimeSeconds, 60);
    assert.equal(productPolicy.initialCredit, 100);
    assert.equal(productPolicy.noShowPenaltyPoints, 15);
    assert.equal(productPolicy.bookingRestrictionBelowCredit, 40);
    assert.equal(productPolicy.gpsSimulatorIntervalMs, 5_000);
    assert.equal(productPolicy.locationRetentionMs, 7 * 24 * 60 * 60 * 1_000);
  });

  it("supports narrow test overrides without mutating defaults", () => {
    const testPolicy = createProductPolicy({ qrTokenLifetimeSeconds: 2 });

    assert.equal(testPolicy.qrTokenLifetimeSeconds, 2);
    assert.equal(productPolicy.qrTokenLifetimeSeconds, 60);
    assert.equal(Object.isFrozen(testPolicy), true);
  });
});

describe("clock contract", () => {
  it("returns deterministic defensive Date values", () => {
    const clock = fixedClock("2026-08-15T01:00:00.000Z");
    const first = clock.now();
    first.setUTCFullYear(2030);

    assert.equal(clock.now().toISOString(), "2026-08-15T01:00:00.000Z");
  });

  it("rejects invalid fixed instants", () => {
    assert.throws(() => fixedClock("not-a-date"), /valid date\/time/);
  });
});
