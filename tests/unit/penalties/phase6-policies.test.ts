import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deductNoShowCredit,
  isBookingRestricted,
  restoreCredit,
} from "../../../src/features/penalties/domain/credit-policy";
import { isReservedNoShow } from "../../../src/features/penalties/domain/no-show-policy";
import {
  assertAppealPending,
  assertPenaltyCanBeAppealed,
  penaltyStatusForAppealDecision,
  PenaltyLifecycleError,
} from "../../../src/features/penalties/domain/penalty-lifecycle";
import { createProductPolicy } from "../../../src/shared/config/policies";

const policy = createProductPolicy();
const progressedAt = new Date("2026-08-15T04:00:00.000Z");

describe("Phase 6 reserved no-show evidence", () => {
  it("requires a confirmed, unboarded Booking and actual stop progress", () => {
    assert.equal(
      isReservedNoShow({
        bookingStatus: "CONFIRMED",
        checkedInAt: null,
        boardingActualDeparture: progressedAt,
        boardingPassedAt: null,
      }),
      true,
    );
    assert.equal(
      isReservedNoShow({
        bookingStatus: "CONFIRMED",
        checkedInAt: progressedAt,
        boardingActualDeparture: progressedAt,
        boardingPassedAt: progressedAt,
      }),
      false,
    );
    assert.equal(
      isReservedNoShow({
        bookingStatus: "CONFIRMED",
        checkedInAt: null,
        boardingActualDeparture: null,
        boardingPassedAt: null,
      }),
      false,
    );
  });
});

describe("Phase 6 credit and restriction policy", () => {
  it("deducts the configured amount once and clamps at zero", () => {
    assert.deepEqual(deductNoShowCredit(100, policy), {
      score: 85,
      pointsChanged: 15,
    });
    assert.deepEqual(deductNoShowCredit(5, policy), {
      score: 0,
      pointsChanged: 5,
    });
  });

  it("restores the recorded points and clamps at the configured maximum", () => {
    assert.deepEqual(restoreCredit(70, 7, policy), {
      score: 77,
      pointsChanged: 7,
    });
    assert.deepEqual(restoreCredit(95, 15, policy), {
      score: 100,
      pointsChanged: 5,
    });
  });

  it("allows credit 40 and restricts credit 39", () => {
    assert.equal(isBookingRestricted(40, policy), false);
    assert.equal(isBookingRestricted(39, policy), true);
  });
});

describe("Phase 6 penalty and appeal lifecycle", () => {
  it("allows appeals only from ACTIVE penalties", () => {
    assert.doesNotThrow(() => assertPenaltyCanBeAppealed("ACTIVE"));
    assert.throws(
      () => assertPenaltyCanBeAppealed("APPEALED"),
      (error) =>
        error instanceof PenaltyLifecycleError &&
        error.code === "NOT_APPEALABLE",
    );
  });

  it("allows decisions only for pending appeals and maps final statuses", () => {
    assert.doesNotThrow(() => assertAppealPending("PENDING"));
    assert.throws(
      () => assertAppealPending("APPROVED"),
      (error) =>
        error instanceof PenaltyLifecycleError && error.code === "NOT_PENDING",
    );
    assert.throws(
      () => assertAppealPending("REJECTED"),
      (error) =>
        error instanceof PenaltyLifecycleError && error.code === "NOT_PENDING",
    );
    assert.equal(penaltyStatusForAppealDecision("APPROVED"), "OVERTURNED");
    assert.equal(penaltyStatusForAppealDecision("REJECTED"), "UPHELD");
  });
});
