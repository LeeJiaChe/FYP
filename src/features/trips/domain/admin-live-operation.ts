export interface AdminLiveTripCandidate {
  readonly id: string;
  readonly status:
    | "NOT_STARTED"
    | "BOARDING"
    | "DEPARTED"
    | "ARRIVED"
    | "CANCELLED";
}

export function selectAdminActiveTrips<T extends AdminLiveTripCandidate>(
  trips: readonly T[],
): T[] {
  return trips.filter(
    (trip) => trip.status === "BOARDING" || trip.status === "DEPARTED",
  );
}

export function resolveAdminMonitoredTripId(
  trips: readonly AdminLiveTripCandidate[],
  selectedTripId: string | null,
): string | null {
  const activeTrips = selectAdminActiveTrips(trips);
  if (
    selectedTripId &&
    activeTrips.some((trip) => trip.id === selectedTripId)
  ) {
    return selectedTripId;
  }

  return activeTrips[0]?.id ?? null;
}
