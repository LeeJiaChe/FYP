import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAlightingComplete,
  shouldAutoCompleteAtPlannedStop,
} from "../../../src/features/boarding/domain/alighting-policy";
import {
  evaluateBoardingEligibility,
  isWalkInIssuanceEligible,
} from "../../../src/features/boarding/domain/boarding-policy";
import {
  assertPassPurpose,
  isPassPurpose,
  isPassTimeValid,
} from "../../../src/features/boarding/domain/pass-contract";
import {
  assertTripTransition,
  isTerminalTripStatus,
} from "../../../src/features/trips/domain/trip-status";
import { createProductPolicy } from "../../../src/shared/config/policies";
import { fixedClock } from "../../../src/shared/time/clock";

const policy = createProductPolicy();
const departure = new Date("2026-08-15T04:00:00.000Z");

describe("Phase 5 pass contracts", () => {
  it("distinguishes every signed purpose and rejects purpose confusion", () => {
    assert.equal(isPassPurpose("RESERVED_BOARDING"), true);
    assert.equal(isPassPurpose("WALK_IN_BOARDING"), true);
    assert.equal(isPassPurpose("ALIGHTING"), true);
    assert.equal(isPassPurpose("RESERVED"), false);
    assert.throws(
      () => assertPassPurpose("ALIGHTING", "RESERVED_BOARDING"),
      /Expected RESERVED_BOARDING/,
    );
  });

  it("evaluates short-lived expiry with an injectable Clock", () => {
    const claims = { issuedAt: 1_755_230_400, expiresAt: 1_755_230_460 };
    assert.equal(
      isPassTimeValid(claims, fixedClock(claims.issuedAt * 1_000 + 59_000)),
      true,
    );
    assert.equal(
      isPassTimeValid(claims, fixedClock(claims.expiresAt * 1_000)),
      false,
    );
  });
});

describe("Phase 5 boarding timing and progress", () => {
  it("opens normally 15 minutes before the planned stop departure", () => {
    const stop = {
      plannedDeparture: departure,
      actualArrival: new Date("2026-08-15T03:45:00.000Z"),
      actualDeparture: null,
      passedAt: null,
    };
    assert.deepEqual(
      evaluateBoardingEligibility(
        new Date("2026-08-15T03:44:59.999Z"),
        "BOARDING",
        stop,
        policy,
      ),
      { allowed: false, reason: "TOO_EARLY" },
    );
    assert.deepEqual(
      evaluateBoardingEligibility(
        new Date("2026-08-15T03:45:00.000Z"),
        "BOARDING",
        stop,
        policy,
      ),
      { allowed: true, delayedWindow: false },
    );
  });

  it("extends late boarding only while the stop is actually arrived and not left", () => {
    const late = new Date("2026-08-15T04:20:00.000Z");
    assert.deepEqual(
      evaluateBoardingEligibility(
        late,
        "DEPARTED",
        {
          plannedDeparture: departure,
          actualArrival: new Date("2026-08-15T04:18:00.000Z"),
          actualDeparture: null,
          passedAt: null,
        },
        policy,
      ),
      { allowed: true, delayedWindow: true },
    );
    assert.deepEqual(
      evaluateBoardingEligibility(
        late,
        "DEPARTED",
        {
          plannedDeparture: departure,
          actualArrival: new Date("2026-08-15T04:18:00.000Z"),
          actualDeparture: late,
          passedAt: late,
        },
        policy,
      ),
      { allowed: false, reason: "STOP_LEFT" },
    );
  });

  it("issues walk-in intent only in the upcoming window or a durable delay", () => {
    const scheduledStop = {
      plannedDeparture: departure,
      actualArrival: null,
      actualDeparture: null,
      passedAt: null,
    };
    assert.equal(
      isWalkInIssuanceEligible(
        new Date("2026-08-08T03:59:59.999Z"),
        "NOT_STARTED",
        scheduledStop,
        policy,
      ),
      false,
    );
    assert.equal(
      isWalkInIssuanceEligible(
        new Date("2026-08-15T04:05:00.001Z"),
        "NOT_STARTED",
        scheduledStop,
        policy,
      ),
      false,
    );
    assert.equal(
      isWalkInIssuanceEligible(
        new Date("2026-08-15T04:20:00.000Z"),
        "BOARDING",
        { ...scheduledStop, actualArrival: departure },
        policy,
      ),
      true,
    );
  });
});

describe("Phase 5 Trip lifecycle", () => {
  it("allows the approved linear transitions and irreversible terminal states", () => {
    assert.doesNotThrow(() => assertTripTransition("NOT_STARTED", "BOARDING"));
    assert.doesNotThrow(() => assertTripTransition("BOARDING", "DEPARTED"));
    assert.doesNotThrow(() => assertTripTransition("DEPARTED", "ARRIVED"));
    assert.equal(isTerminalTripStatus("ARRIVED"), true);
    assert.equal(isTerminalTripStatus("CANCELLED"), true);
    assert.throws(() => assertTripTransition("ARRIVED", "DEPARTED"));
    assert.throws(() => assertTripTransition("CANCELLED", "NOT_STARTED"));
  });

  it("requires an audited reason for emergency cancellation after departure", () => {
    assert.throws(() => assertTripTransition("DEPARTED", "CANCELLED"), /requires a reason/);
    assert.doesNotThrow(() =>
      assertTripTransition("DEPARTED", "CANCELLED", "Mechanical emergency"),
    );
  });
});

describe("Phase 5 alighting policy", () => {
  it("auto-completes when the planned stop is departed or passed", () => {
    assert.equal(
      shouldAutoCompleteAtPlannedStop({ actualDeparture: departure, passedAt: null }),
      true,
    );
    assert.equal(
      shouldAutoCompleteAtPlannedStop({ actualDeparture: null, passedAt: null }),
      false,
    );
  });

  it("requires timestamp and method together as operational evidence", () => {
    assert.equal(
      isAlightingComplete({ actualAlightedAt: departure, alightingMethod: "QR" }),
      true,
    );
    assert.equal(
      isAlightingComplete({ actualAlightedAt: departure, alightingMethod: null }),
      false,
    );
  });
});
