export interface PendingWalkInCandidate {
  readonly id: string;
  readonly tripId: string;
  readonly boardingTripStopId: string;
  readonly status: string;
  readonly expiresAt: Date;
}
export function selectCurrentStopPendingWalkIns<T extends PendingWalkInCandidate>(
  candidates: readonly T[],
  tripId: string,
  currentTripStopId: string | null,
  now: Date,
): T[] {
  if (!currentTripStopId) return [];
  return candidates.filter(
    (candidate) =>
      candidate.tripId === tripId &&
      candidate.boardingTripStopId === currentTripStopId &&
      candidate.status === "PENDING" &&
      candidate.expiresAt.getTime() > now.getTime(),
  );
}
