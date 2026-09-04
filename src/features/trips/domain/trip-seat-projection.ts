export interface SeatBookingProjectionSource {
  readonly id: string;
  readonly studentId: string;
  readonly status: string;
  readonly checkedInAt: Date | null;
  readonly checkInMethod: string | null;
  readonly student: { readonly name: string; readonly studentId: string | null };
  readonly boardingTripStop: { readonly stopName: string };
  readonly dropOffTripStop: { readonly stopName: string };
}

export interface SeatClaimProjectionSource {
  readonly tripSeatId: string;
  readonly booking: SeatBookingProjectionSource;
}

export function projectTripSeatForActor(input: {
  readonly actor: { readonly userId: string; readonly role: string };
  readonly seat: { readonly id: string; readonly seatNumber: number };
  readonly currentClaim?: SeatClaimProjectionSource;
  readonly seatClaims: readonly SeatClaimProjectionSource[];
}) {
  const canViewManifest = input.actor.role === "ADMIN" || input.actor.role === "DRIVER";
  const visibleClaims = canViewManifest
    ? input.seatClaims
    : input.seatClaims.filter(
        (claim) => claim.booking.studentId === input.actor.userId,
      );
  const primary = canViewManifest
    ? input.currentClaim?.booking ?? visibleClaims[0]?.booking
    : visibleClaims.find(
        (claim) => claim.booking.studentId === input.actor.userId,
      )?.booking;
  const studentOwnsCurrentClaim =
    input.currentClaim?.booking.studentId === input.actor.userId;
  const status =
    input.currentClaim === undefined
      ? "AVAILABLE"
      : canViewManifest || studentOwnsCurrentClaim
        ? input.currentClaim.booking.checkedInAt
          ? "CHECKED_IN"
          : "RESERVED"
        : "UNAVAILABLE";

  return {
    id: input.seat.id,
    seatNumber: input.seat.seatNumber,
    status,
    booking: primary
      ? {
          id: primary.id,
          status: primary.status,
          studentName: primary.student.name,
          studentId: primary.student.studentId,
          checkedInAt: primary.checkedInAt,
          checkInMethod: primary.checkInMethod,
        }
      : null,
    journeys: visibleClaims.map(({ booking }) => ({
      bookingId: booking.id,
      boardingStopName: booking.boardingTripStop.stopName,
      dropOffStopName: booking.dropOffTripStop.stopName,
      status: booking.status,
    })),
  };
}
