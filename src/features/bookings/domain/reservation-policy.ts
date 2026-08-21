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
  readonly boardingActualArrival: Date | null;
  readonly boardingActualDeparture: Date | null;
  readonly boardingPassedAt: Date | null;
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
  if (input.tripStatus === "ARRIVED" || input.tripStatus === "CANCELLED") {
    throw new ReservationPolicyError("NOT_BOOKABLE");
  }

  const departure = input.boardingPlannedDeparture.getTime();
  const now = input.now.getTime();
  if (now < departure - policy.bookingOpenLeadMs) {
    throw new ReservationPolicyError("TOO_EARLY");
  }
  if (
    input.boardingActualArrival !== null ||
    input.boardingActualDeparture !== null ||
    input.boardingPassedAt !== null
  ) {
    throw new ReservationPolicyError("TOO_LATE");
  }
}

export interface WaitlistPromotionEligibility {
  readonly tripStatus: string;
  readonly boardingActualArrival: Date | null;
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
    input.boardingActualArrival === null &&
    input.boardingActualDeparture === null &&
    input.boardingPassedAt === null
  );
}

export interface ReservedCancellationEligibility {
  readonly bookingStatus: string;
  readonly checkedInAt: Date | null;
  readonly boardingActualArrival: Date | null;
  readonly boardingActualDeparture: Date | null;
  readonly boardingPassedAt: Date | null;
}

export function canCancelReservedBooking(
  input: ReservedCancellationEligibility,
): boolean {
  return (
    input.bookingStatus === "CONFIRMED" &&
    input.checkedInAt === null &&
    input.boardingActualArrival === null &&
    input.boardingActualDeparture === null &&
    input.boardingPassedAt === null
  );
}

export function canTransitionReservedBookingToCancelled(status: string): boolean {
  return status === "CONFIRMED";
}
