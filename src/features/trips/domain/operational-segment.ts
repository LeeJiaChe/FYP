export interface OperationalStopProgress {
  readonly position: number;
  readonly actualArrival: Date | null;
  readonly actualDeparture: Date | null;
  readonly passedAt: Date | null;
}

/**
 * Returns the segment currently being boarded or traversed. Operational stop
 * evidence is authoritative; wall-clock schedule interpolation is never used.
 */
export function currentOperationalSegmentPosition(
  tripStatus: string,
  stops: readonly OperationalStopProgress[],
): number | null {
  if (tripStatus === "ARRIVED" || tripStatus === "CANCELLED" || stops.length < 2) {
    return null;
  }

  const ordered = [...stops].sort((left, right) => left.position - right.position);
  const arrivedAndBoarding = [...ordered]
    .reverse()
    .find((stop) => stop.actualArrival && !stop.actualDeparture && !stop.passedAt);
  if (arrivedAndBoarding && arrivedAndBoarding.position < ordered.length - 1) {
    return arrivedAndBoarding.position;
  }

  const lastDeparted = [...ordered]
    .reverse()
    .find((stop) => stop.actualDeparture || stop.passedAt);
  if (lastDeparted && lastDeparted.position < ordered.length - 1) {
    return lastDeparted.position;
  }

  return 0;
}

export function operationalProgressLabel(
  tripStatus: string,
  currentStopName: string | null,
): string {
  if (tripStatus === "ARRIVED") return "Arrived at final stop";
  if (tripStatus === "CANCELLED") return "Trip cancelled";
  if (currentStopName) return `Current stop: ${currentStopName}`;
  if (tripStatus === "DEPARTED") return "Between stops";
  if (tripStatus === "BOARDING") return "Boarding in progress";
  return "Trip not started";
}
