export const DEFAULT_TRAFFIC_ETA_CACHE_MS = 45_000;
export const DEFAULT_TRAFFIC_ETA_FAILURE_CACHE_MS = 15_000;
export const DEFAULT_TRAFFIC_ETA_TIMEOUT_MS = 3_000;
export const DEFAULT_TRAFFIC_ETA_MAX_LOCATION_AGE_MS = 60_000;

export interface OperationalTripStopSnapshot {
  readonly id: string;
  readonly position: number;
  readonly stopCode: string;
  readonly stopName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly plannedArrival: Date;
  readonly actualArrival?: Date | null;
  readonly actualDeparture?: Date | null;
  readonly passedAt?: Date | null;
}

export interface RouteLegSnapshot {
  readonly durationSeconds: number;
  readonly staticDurationSeconds: number;
  readonly distanceMeters: number;
}

export interface DerivedStopEta {
  readonly tripStopId: string;
  readonly stopCode: string;
  readonly stopName: string;
  readonly position: number;
  readonly plannedArrival: string;
  readonly estimatedArrival: string;
  readonly minutesAway: number;
  readonly scheduleVarianceMinutes: number;
  readonly cumulativeDistanceMeters: number | null;
}

/**
 * Parses Google Routes API duration string (e.g. "120s", "120.5s") into seconds.
 */
export function parseGoogleDurationSeconds(duration: string): number {
  if (typeof duration !== "string") {
    throw new RangeError(`Invalid Google duration string: ${String(duration)}`);
  }
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration.trim());
  if (!match || match[1] === undefined) {
    throw new RangeError(`Invalid Google duration string: "${duration}"`);
  }
  const parsed = Number.parseFloat(match[1]);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RangeError(`Invalid Google duration value: "${duration}"`);
  }
  return parsed;
}

/**
 * Calculates traffic impact minutes as max(0, traffic - static).
 * Explicitly NOT labeled schedule delay.
 */
export function calculateTrafficImpactMinutes(
  trafficDurationSeconds: number,
  staticDurationSeconds: number,
): number {
  const diffSeconds = trafficDurationSeconds - staticDurationSeconds;
  return Math.max(0, Math.round(diffSeconds / 60));
}

/**
 * Calculates timetable schedule variance in minutes:
 * positive: running later than planned timetable
 * negative: ahead of timetable
 */
export function calculateScheduleVarianceMinutes(
  estimatedArrival: Date,
  plannedArrival: Date,
): number {
  return Math.round(
    (estimatedArrival.getTime() - plannedArrival.getTime()) / 60_000,
  );
}

/**
 * Resolves remaining not-yet-passed stops and current operational context.
 */
export function resolveRemainingStops(
  tripStatus: string,
  stops: readonly OperationalTripStopSnapshot[],
): {
  remainingStops: OperationalTripStopSnapshot[];
  currentStop: OperationalTripStopSnapshot | null;
  nextStop: OperationalTripStopSnapshot | null;
} {
  if (tripStatus === "ARRIVED" || tripStatus === "CANCELLED" || stops.length === 0) {
    return { remainingStops: [], currentStop: null, nextStop: null };
  }

  const ordered = [...stops].sort((left, right) => left.position - right.position);

  // Stop currently being boarded or dwelled at
  const boardingStop = [...ordered]
    .reverse()
    .find((stop) => stop.actualArrival && !stop.actualDeparture && !stop.passedAt) ?? null;

  // Unpassed stops (neither departed nor marked passed)
  const unpassed = ordered.filter(
    (stop) => !stop.actualDeparture && !stop.passedAt,
  );

  if (boardingStop) {
    // If bus is currently at boardingStop, remaining stops to route along road are stops after it
    const downstream = unpassed.filter((stop) => stop.position > boardingStop.position);
    return {
      remainingStops: downstream,
      currentStop: boardingStop,
      nextStop: downstream[0] ?? null,
    };
  }

  return {
    remainingStops: unpassed,
    currentStop: null,
    nextStop: unpassed[0] ?? null,
  };
}

/**
 * Computes cumulative stop ETAs from Google route legs.
 */
export function calculateCumulativeLegEtas({
  generatedAt,
  remainingStops,
  legs,
}: {
  generatedAt: Date;
  remainingStops: readonly OperationalTripStopSnapshot[];
  legs: readonly RouteLegSnapshot[];
}): DerivedStopEta[] {
  let cumulativeSeconds = 0;
  let cumulativeDistance = 0;

  return remainingStops.map((stop, index) => {
    const leg = legs[index];
    if (leg) {
      cumulativeSeconds += leg.durationSeconds;
      cumulativeDistance += leg.distanceMeters;
    }

    const estimatedArrivalDate = new Date(
      generatedAt.getTime() + cumulativeSeconds * 1_000,
    );
    const minutesAway = Math.max(0, Math.round(cumulativeSeconds / 60));
    const scheduleVariance = calculateScheduleVarianceMinutes(
      estimatedArrivalDate,
      stop.plannedArrival,
    );

    return {
      tripStopId: stop.id,
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      position: stop.position,
      plannedArrival: stop.plannedArrival.toISOString(),
      estimatedArrival: estimatedArrivalDate.toISOString(),
      minutesAway,
      scheduleVarianceMinutes: scheduleVariance,
      cumulativeDistanceMeters: cumulativeDistance,
    };
  });
}

/**
 * Computes schedule fallback ETAs using timetable and trip delay.
 */
export function calculateScheduleFallbackEtas({
  now,
  remainingStops,
  delayMinutes,
}: {
  now: Date;
  remainingStops: readonly OperationalTripStopSnapshot[];
  delayMinutes: number;
}): DerivedStopEta[] {
  return remainingStops.map((stop) => {
    const estimatedArrivalDate = new Date(
      stop.plannedArrival.getTime() + delayMinutes * 60_000,
    );
    const minutesAway = Math.max(
      0,
      Math.round((estimatedArrivalDate.getTime() - now.getTime()) / 60_000),
    );

    return {
      tripStopId: stop.id,
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      position: stop.position,
      plannedArrival: stop.plannedArrival.toISOString(),
      estimatedArrival: estimatedArrivalDate.toISOString(),
      minutesAway,
      scheduleVarianceMinutes: delayMinutes,
      cumulativeDistanceMeters: null,
    };
  });
}
