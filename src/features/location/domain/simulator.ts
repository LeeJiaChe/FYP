export interface SimulatorStop {
  readonly position: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly plannedDeparture: Date;
  readonly plannedArrival: Date;
  readonly actualArrival: Date | null;
  readonly actualDeparture: Date | null;
  readonly passedAt: Date | null;
}

export interface SimulatedCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export function interpolateCoordinate(
  from: Pick<SimulatorStop, "latitude" | "longitude">,
  to: Pick<SimulatorStop, "latitude" | "longitude">,
  ratio: number,
): SimulatedCoordinate {
  const bounded = Math.max(0, Math.min(1, ratio));
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * bounded,
    longitude: from.longitude + (to.longitude - from.longitude) * bounded,
  };
}

export function simulatorCoordinateForSegment(
  from: SimulatorStop,
  to: SimulatorStop,
  now: Date,
): SimulatedCoordinate {
  if (!from.actualDeparture) return interpolateCoordinate(from, to, 0);
  const plannedDuration = Math.max(
    60_000,
    to.plannedArrival.getTime() - from.plannedDeparture.getTime(),
  );
  const elapsed = Math.max(0, now.getTime() - from.actualDeparture.getTime());
  return interpolateCoordinate(from, to, Math.min(0.98, elapsed / plannedDuration));
}

