import {
  MAX_ROUTE_STOPS,
  MIN_ROUTE_STOPS,
} from "@/shared/config/topology";

export interface TripRouteStopSource {
  readonly stopId: string;
  readonly position: number;
  readonly stopCode: string;
  readonly stopName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly travelDurationToNextMinutes: number | null;
}

export interface TripStopSnapshot extends TripRouteStopSource {
  readonly plannedArrival: Date;
  readonly plannedDeparture: Date;
  readonly boardingDeadline: Date;
}

export interface TripSnapshot {
  readonly seatedCapacity: number;
  readonly standingCapacity: number;
  readonly stops: readonly TripStopSnapshot[];
  readonly segmentPositions: readonly number[];
  readonly seatNumbers: readonly number[];
  readonly estimatedArrivalTime: Date;
}

export class TripSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripSnapshotError";
  }
}

export function buildTripSnapshot(input: {
  readonly originDeparture: Date;
  readonly boardingCloseGraceMs: number;
  readonly seatedCapacity: number;
  readonly standingCapacity: number;
  readonly routeStops: readonly TripRouteStopSource[];
}): TripSnapshot {
  const departureTimestamp = input.originDeparture.getTime();
  if (!Number.isFinite(departureTimestamp)) {
    throw new TripSnapshotError("Origin departure must be a valid date/time");
  }
  if (!Number.isInteger(input.seatedCapacity) || input.seatedCapacity <= 0) {
    throw new TripSnapshotError("Seated capacity must be a positive integer");
  }
  if (!Number.isInteger(input.standingCapacity) || input.standingCapacity < 0) {
    throw new TripSnapshotError("Standing capacity must be a non-negative integer");
  }
  if (
    !Number.isInteger(input.boardingCloseGraceMs) ||
    input.boardingCloseGraceMs < 0
  ) {
    throw new TripSnapshotError("Boarding-close grace must be non-negative");
  }
  if (
    input.routeStops.length < MIN_ROUTE_STOPS ||
    input.routeStops.length > MAX_ROUTE_STOPS
  ) {
    throw new TripSnapshotError(
      `A Trip requires ${MIN_ROUTE_STOPS} to ${MAX_ROUTE_STOPS} RouteStops`,
    );
  }
  if (
    new Set(input.routeStops.map((stop) => stop.stopId)).size !==
    input.routeStops.length
  ) {
    throw new TripSnapshotError("A Trip route cannot repeat a Stop");
  }

  let offsetMinutes = 0;
  const stops = input.routeStops.map((stop, index) => {
    if (stop.position !== index) {
      throw new TripSnapshotError(
        "RouteStop positions must be contiguous and zero-based",
      );
    }
    const terminal = index === input.routeStops.length - 1;
    if (terminal && stop.travelDurationToNextMinutes !== null) {
      throw new TripSnapshotError(
        "The final RouteStop cannot have travel time to a next stop",
      );
    }
    if (
      !terminal &&
      (!Number.isInteger(stop.travelDurationToNextMinutes) ||
        (stop.travelDurationToNextMinutes ?? 0) <= 0)
    ) {
      throw new TripSnapshotError(
        "Every non-final RouteStop requires positive travel time",
      );
    }

    const plannedTime = new Date(
      departureTimestamp + offsetMinutes * 60 * 1_000,
    );
    const snapshot = Object.freeze({
      ...stop,
      plannedArrival: plannedTime,
      plannedDeparture: plannedTime,
      boardingDeadline: new Date(
        plannedTime.getTime() + input.boardingCloseGraceMs,
      ),
    });

    if (!terminal) offsetMinutes += stop.travelDurationToNextMinutes ?? 0;
    return snapshot;
  });

  return Object.freeze({
    seatedCapacity: input.seatedCapacity,
    standingCapacity: input.standingCapacity,
    stops: Object.freeze(stops),
    segmentPositions: Object.freeze(
      Array.from({ length: stops.length - 1 }, (_, position) => position),
    ),
    seatNumbers: Object.freeze(
      Array.from(
        { length: input.seatedCapacity },
        (_, seatIndex) => seatIndex + 1,
      ),
    ),
    estimatedArrivalTime: new Date(
      departureTimestamp + offsetMinutes * 60 * 1_000,
    ),
  });
}
