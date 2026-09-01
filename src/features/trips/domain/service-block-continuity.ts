export type ServiceBlockContinuity = "CONTINUOUS" | "DEADHEAD_REQUIRED";

export interface ContinuityTrip {
  readonly tripStops: readonly { readonly stopId: string; readonly position: number }[];
}

export function evaluateServiceBlockContinuity(
  previousTrip: ContinuityTrip,
  nextTrip: ContinuityTrip,
): ServiceBlockContinuity {
  const previousStops = [...previousTrip.tripStops].sort(
    (left, right) => left.position - right.position,
  );
  const nextStops = [...nextTrip.tripStops].sort(
    (left, right) => left.position - right.position,
  );
  const previousTerminal = previousStops.at(-1);
  const nextOrigin = nextStops[0];

  if (!previousTerminal || !nextOrigin) {
    return "DEADHEAD_REQUIRED";
  }

  return previousTerminal.stopId === nextOrigin.stopId
    ? "CONTINUOUS"
    : "DEADHEAD_REQUIRED";
}
