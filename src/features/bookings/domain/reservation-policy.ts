import type { ProductPolicy } from "@/shared/config/policies";

export class ReservationPolicyError extends Error {
  constructor(readonly code: "NOT_BOOKABLE" | "RESTRICTED" | "TOO_EARLY" | "TOO_LATE") {
    super(code);
    this.name = "ReservationPolicyError";
  }
}

export interface ReservationEligibility {
  readonly tripStatus: string;
  readonly boardingPlannedDeparture: Date;
  readonly studentCredit: number;
  readonly now: Date;
}

export function assertReservationEligibility(
  input: ReservationEligibility,
  policy: ProductPolicy,
): void {
  if (input.studentCredit < policy.bookingRestrictionBelowCredit) {
    throw new ReservationPolicyError("RESTRICTED");
  }
  if (input.tripStatus !== "NOT_STARTED") {
    throw new ReservationPolicyError("NOT_BOOKABLE");
  }

  const departure = input.boardingPlannedDeparture.getTime();
  const now = input.now.getTime();
  if (now < departure - policy.bookingOpenLeadMs) {
    throw new ReservationPolicyError("TOO_EARLY");
  }
  if (now >= departure) {
    throw new ReservationPolicyError("TOO_LATE");
  }
}

export interface WaitlistPromotionEligibility {
  readonly tripStatus: string;
  readonly boardingActualDeparture: Date | null;
  readonly boardingPassedAt: Date | null;
  readonly studentCredit: number;
}

export function canPromoteWaitlistEntry(
  input: WaitlistPromotionEligibility,
  policy: ProductPolicy,
): boolean {
  return (
    input.studentCredit >= policy.bookingRestrictionBelowCredit &&
    input.tripStatus !== "ARRIVED" &&
    input.tripStatus !== "CANCELLED" &&
    input.boardingActualDeparture === null &&
    input.boardingPassedAt === null
  );
}

export function canCancelReservedBooking(
  now: Date,
  boardingPlannedDeparture: Date,
  policy: ProductPolicy,
): boolean {
  return (
    now.getTime() <
    boardingPlannedDeparture.getTime() - policy.reservedCancellationLeadMs
  );
}

export function canTransitionReservedBookingToCancelled(status: string): boolean {
  return status === "CONFIRMED";
}
