import type { ProductPolicy } from "@/shared/config/policies";

export class ReservationPolicyError extends Error {
  constructor(readonly code: "NOT_BOOKABLE" | "RESTRICTED" | "TOO_EARLY" | "TOO_LATE") {
    super(code);
    this.name = "ReservationPolicyError";
  }
}

export type StudentBookingEligibilityReason =
  | "AVAILABLE"
  | "BOOKING_NOT_OPEN"
  | "BOOKING_CLOSED"
  | "TRIP_CANCELLED"
  | "TRIP_COMPLETED"
  | "CREDIT_RESTRICTED"
  | "FULL";

export interface StudentBookingEligibility {
  readonly canReserve: boolean;
  readonly canJoinWaitlist: boolean;
  readonly canCreateWalkInIntent: boolean;
  readonly reason: StudentBookingEligibilityReason;
  readonly opensAt?: string;
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

export function resolveStudentBookingEligibility(
  input: ReservationEligibility,
  policy: ProductPolicy,
  options: {
    readonly hasAvailableSeat?: boolean;
    readonly canCreateWalkInIntent?: boolean;
  } = {},
): StudentBookingEligibility {
  const opensAt = new Date(
    input.boardingPlannedDeparture.getTime() - policy.bookingOpenLeadMs,
  ).toISOString();
  const unavailable = (
    reason: Exclude<StudentBookingEligibilityReason, "AVAILABLE" | "FULL">,
  ): StudentBookingEligibility => ({
    canReserve: false,
    canJoinWaitlist: false,
    canCreateWalkInIntent: options.canCreateWalkInIntent ?? false,
    reason,
    opensAt,
  });

  if (input.tripStatus === "CANCELLED") return unavailable("TRIP_CANCELLED");
  if (input.tripStatus === "ARRIVED") return unavailable("TRIP_COMPLETED");
  if (input.studentCredit < policy.bookingRestrictionBelowCredit) {
    return unavailable("CREDIT_RESTRICTED");
  }
  if (input.now.getTime() < new Date(opensAt).getTime()) {
    return unavailable("BOOKING_NOT_OPEN");
  }
  if (
    input.boardingActualArrival !== null ||
    input.boardingActualDeparture !== null ||
    input.boardingPassedAt !== null
  ) {
    return unavailable("BOOKING_CLOSED");
  }
  if (options.hasAvailableSeat === false) {
    return {
      canReserve: false,
      canJoinWaitlist: true,
      canCreateWalkInIntent: options.canCreateWalkInIntent ?? false,
      reason: "FULL",
      opensAt,
    };
  }
  return {
    canReserve: true,
    canJoinWaitlist: false,
    canCreateWalkInIntent: options.canCreateWalkInIntent ?? false,
    reason: "AVAILABLE",
    opensAt,
  };
}

export function assertReservationEligibility(
  input: ReservationEligibility,
  policy: ProductPolicy,
): void {
  const eligibility = resolveStudentBookingEligibility(input, policy);
  if (eligibility.canReserve) return;
  if (eligibility.reason === "CREDIT_RESTRICTED") {
    throw new ReservationPolicyError("RESTRICTED");
  }
  if (eligibility.reason === "BOOKING_NOT_OPEN") {
    throw new ReservationPolicyError("TOO_EARLY");
  }
  if (eligibility.reason === "BOOKING_CLOSED") {
    throw new ReservationPolicyError("TOO_LATE");
  }
  throw new ReservationPolicyError("NOT_BOOKABLE");
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
