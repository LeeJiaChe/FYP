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
