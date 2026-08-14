import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertReservationEligibility,
  canCancelReservedBooking,
  canTransitionReservedBookingToCancelled,
  ReservationPolicyError,
} from "../../../src/features/bookings/domain/reservation-policy";
import { createProductPolicy } from "../../../src/shared/config/policies";

const policy = createProductPolicy({
  bookingOpenLeadMs: 1_000,
  reservedCancellationLeadMs: 300,
});
const departure = new Date(2_000);

function eligibility(now: number) {
  return {
    tripStatus: "NOT_STARTED",
    boardingPlannedDeparture: departure,
    studentCredit: 100,
    studentRestricted: false,
    now: new Date(now),
  };
}

describe("reserved booking timing and credit policy", () => {
  it("uses the boarding-stop departure for booking open and close", () => {
    assert.throws(
      () => assertReservationEligibility(eligibility(999), policy),
      (error) => error instanceof ReservationPolicyError && error.code === "TOO_EARLY",
    );
    assert.doesNotThrow(() => assertReservationEligibility(eligibility(1_000), policy));
    assert.throws(
      () => assertReservationEligibility(eligibility(2_000), policy),
      (error) => error instanceof ReservationPolicyError && error.code === "TOO_LATE",
    );
  });

  it("enforces lifecycle, credit and boarding-stop cancellation cutoff", () => {
    assert.throws(
      () =>
        assertReservationEligibility(
          { ...eligibility(1_100), tripStatus: "BOARDING" },
          policy,
        ),
      ReservationPolicyError,
    );
    assert.throws(
      () =>
        assertReservationEligibility(
          { ...eligibility(1_100), studentCredit: 39 },
          policy,
        ),
      ReservationPolicyError,
    );
    assert.equal(canCancelReservedBooking(new Date(1_699), departure, policy), true);
    assert.equal(canCancelReservedBooking(new Date(1_700), departure, policy), false);
    assert.equal(canTransitionReservedBookingToCancelled("CONFIRMED"), true);
    assert.equal(canTransitionReservedBookingToCancelled("COMPLETED"), false);
    assert.equal(canTransitionReservedBookingToCancelled("NO_SHOW"), false);
  });
});
