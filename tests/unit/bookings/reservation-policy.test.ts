import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertReservationEligibility,
  canCancelReservedBooking,
  canPromoteWaitlistEntry,
  canTransitionReservedBookingToCancelled,
  ReservationPolicyError,
  resolveStudentBookingEligibility,
} from "../../../src/features/bookings/domain/reservation-policy";
import { createProductPolicy } from "../../../src/shared/config/policies";

const policy = createProductPolicy({ bookingOpenLeadMs: 1_000 });
const departure = new Date(2_000);

function eligibility(overrides: Partial<Parameters<typeof assertReservationEligibility>[0]> = {}) {
  return {
    tripStatus: "NOT_STARTED",
    boardingPlannedDeparture: departure,
    boardingActualArrival: null,
    boardingActualDeparture: null,
    boardingPassedAt: null,
    studentCredit: 100,
    now: new Date(1_000),
    ...overrides,
  };
}

function assertPolicyCode(
  input: Parameters<typeof assertReservationEligibility>[0],
  code: ReservationPolicyError["code"],
) {
  assert.throws(
    () => assertReservationEligibility(input, policy),
    (error) => error instanceof ReservationPolicyError && error.code === code,
  );
}

describe("reserved booking operational timing and credit policy", () => {
  it("rejects booking before the seven-day-derived opening boundary", () => {
    assertPolicyCode(eligibility({ now: new Date(999) }), "TOO_EARLY");
  });

  it("allows booking after opening and before actual arrival", () => {
    assert.doesNotThrow(() => assertReservationEligibility(eligibility(), policy));
  });

  it("allows delayed booking after planned departure when the bus has not arrived", () => {
    assert.doesNotThrow(() =>
      assertReservationEligibility(eligibility({ now: new Date(20_000) }), policy),
    );
  });

  it("allows a future-stop journey after the Trip departed an earlier stop", () => {
    assert.doesNotThrow(() =>
      assertReservationEligibility(
        eligibility({ tripStatus: "DEPARTED", now: new Date(20_000) }),
        policy,
      ),
    );
  });

  it("closes booking on actual arrival, departure, or passed evidence", () => {
    assertPolicyCode(eligibility({ boardingActualArrival: new Date(1_500) }), "TOO_LATE");
    assertPolicyCode(eligibility({ boardingActualDeparture: new Date(1_500) }), "TOO_LATE");
    assertPolicyCode(eligibility({ boardingPassedAt: new Date(1_500) }), "TOO_LATE");
  });

  it("rejects terminal Trips", () => {
    assertPolicyCode(eligibility({ tripStatus: "ARRIVED" }), "NOT_BOOKABLE");
    assertPolicyCode(eligibility({ tripStatus: "CANCELLED" }), "NOT_BOOKABLE");
  });

  it("retains the credit restriction boundary", () => {
    assert.doesNotThrow(() =>
      assertReservationEligibility(eligibility({ studentCredit: 40 }), policy),
    );
    assertPolicyCode(eligibility({ studentCredit: 39 }), "RESTRICTED");
  });

  it("returns stable student-facing reasons for terminal and timing states", () => {
    const base = {
      boardingPlannedDeparture: new Date("2026-09-10T01:00:00Z"),
      boardingActualArrival: null,
      boardingActualDeparture: null,
      boardingPassedAt: null,
      studentCredit: 100,
      now: new Date("2026-09-10T00:59:58Z"),
    };
    assert.equal(resolveStudentBookingEligibility({ ...base, tripStatus: "CANCELLED" }, policy).reason, "TRIP_CANCELLED");
    assert.equal(resolveStudentBookingEligibility({ ...base, tripStatus: "ARRIVED" }, policy).reason, "TRIP_COMPLETED");
    assert.equal(resolveStudentBookingEligibility({ ...base, tripStatus: "NOT_STARTED" }, policy).reason, "BOOKING_NOT_OPEN");
    assert.equal(resolveStudentBookingEligibility({ ...base, tripStatus: "NOT_STARTED", now: new Date("2026-09-10T00:59:59Z"), boardingActualArrival: new Date("2026-09-10T00:59:59Z") }, policy).reason, "BOOKING_CLOSED");
  });

  it("distinguishes reservable capacity from a full-journey waitlist", () => {
    const input = {
      tripStatus: "NOT_STARTED",
      boardingPlannedDeparture: new Date("2026-09-10T01:00:00Z"),
      boardingActualArrival: null,
      boardingActualDeparture: null,
      boardingPassedAt: null,
      studentCredit: 100,
      now: new Date("2026-09-10T00:59:59Z"),
    };
    assert.deepEqual(resolveStudentBookingEligibility(input, policy, { hasAvailableSeat: true }).canReserve, true);
    const full = resolveStudentBookingEligibility(input, policy, { hasAvailableSeat: false });
    assert.equal(full.reason, "FULL");
    assert.equal(full.canJoinWaitlist, true);
  });
});

describe("reserved cancellation operational boundary", () => {
  const cancellable = {
    bookingStatus: "CONFIRMED",
    checkedInAt: null,
    boardingActualArrival: null,
    boardingActualDeparture: null,
    boardingPassedAt: null,
  };

  it("remains cancellable after the obsolete scheduled cutoff while the bus has not arrived", () => {
    assert.equal(canCancelReservedBooking(cancellable), true);
  });

  it("closes on actual arrival and rejects a boarded Booking", () => {
    assert.equal(
      canCancelReservedBooking({ ...cancellable, boardingActualArrival: new Date() }),
      false,
    );
    assert.equal(
      canCancelReservedBooking({ ...cancellable, checkedInAt: new Date() }),
      false,
    );
    assert.equal(canTransitionReservedBookingToCancelled("CONFIRMED"), true);
    assert.equal(canTransitionReservedBookingToCancelled("COMPLETED"), false);
    assert.equal(canTransitionReservedBookingToCancelled("NO_SHOW"), false);
  });
});

describe("waitlist promotion operational boundary", () => {
  it("cannot promote after boarding begins at that waiter's stop", () => {
    assert.equal(
      canPromoteWaitlistEntry(
        {
          tripStatus: "DEPARTED",
          boardingActualArrival: new Date(),
          boardingActualDeparture: null,
          boardingPassedAt: null,
          studentCredit: 100,
        },
        policy,
      ),
      false,
    );
  });
});
