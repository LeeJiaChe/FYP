export interface StudentJourneyBooking {
  readonly status: string;
  readonly checkedInAt?: string | Date | null;
  readonly actualAlightedAt?: string | Date | null;
  readonly trip?: {
    readonly departureTime?: string | Date | null;
    readonly status?: string | null;
  } | null;
}

export type StudentJourneyClassification =
  | "ACTIVE_BOARDED"
  | "UPCOMING"
  | "PAST";

function hasNonTerminalTrip(booking: StudentJourneyBooking): boolean {
  return !["ARRIVED", "CANCELLED"].includes(booking.trip?.status ?? "");
}

export function isActiveBoardedJourney(
  booking: StudentJourneyBooking,
): boolean {
  return (
    booking.status === "CONFIRMED" &&
    booking.checkedInAt != null &&
    booking.actualAlightedAt == null &&
    hasNonTerminalTrip(booking)
  );
}

export function classifyStudentJourney(
  booking: StudentJourneyBooking,
  nowMs: number,
): StudentJourneyClassification {
  if (isActiveBoardedJourney(booking)) return "ACTIVE_BOARDED";

  const departureMs = new Date(
    booking.trip?.departureTime ?? Number.NaN,
  ).getTime();
  if (
    booking.status === "CONFIRMED" &&
    booking.checkedInAt == null &&
    booking.actualAlightedAt == null &&
    hasNonTerminalTrip(booking) &&
    Number.isFinite(departureMs) &&
    departureMs >= nowMs
  ) {
    return "UPCOMING";
  }

  return "PAST";
}

export function shouldShowStudentJourneyEta(
  booking: StudentJourneyBooking,
  nowMs: number,
): boolean {
  return classifyStudentJourney(booking, nowMs) !== "PAST";
}

export function selectStudentEtaBooking<T extends StudentJourneyBooking>(
  bookings: readonly T[],
  nowMs: number,
): T | undefined {
  const activeJourney = bookings.find(isActiveBoardedJourney);
  if (activeJourney) return activeJourney;

  return bookings
    .filter(
      (booking) => classifyStudentJourney(booking, nowMs) === "UPCOMING",
    )
    .sort(
      (a, b) =>
        new Date(a.trip?.departureTime ?? Number.NaN).getTime() -
        new Date(b.trip?.departureTime ?? Number.NaN).getTime(),
    )[0];
}
