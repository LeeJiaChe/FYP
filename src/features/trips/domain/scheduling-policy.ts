export interface TripPassengerState {
  readonly bookings: number;
  readonly waitlistEntries: number;
  readonly walkInIntents: number;
  readonly walkInJourneys: number;
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
): boolean {
  return firstStart < secondEnd && firstEnd > secondStart;
}

export function hasPassengerState(state: TripPassengerState): boolean {
  return (
    state.bookings +
      state.waitlistEntries +
      state.walkInIntents +
      state.walkInJourneys >
    0
  );
}

export function canEditSchedule(
  status: string,
  state: TripPassengerState,
): boolean {
  return status === "NOT_STARTED" && !hasPassengerState(state);
}

const malaysiaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toServiceDateKey(date: Date | string): string {
  const parsed = typeof date === "string" ? new Date(date) : date;
  return malaysiaDateFormatter.format(parsed);
}

export function isSameServiceDate(
  first: Date | string,
  second: Date | string,
): boolean {
  return toServiceDateKey(first) === toServiceDateKey(second);
}
