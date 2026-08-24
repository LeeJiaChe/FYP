import {
  MAX_ROUTE_STOPS,
  MIN_ROUTE_STOPS,
} from "@/shared/config/topology";

export interface RouteStopDefinition {
  readonly stopId: string;
  readonly travelDurationToNextMinutes: number | null;
}

export interface PositionedRouteStop extends RouteStopDefinition {
  readonly position: number;
}

export class RouteTopologyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RouteTopologyError";
  }
}

export function positionRouteStops(
  stops: readonly RouteStopDefinition[],
): readonly PositionedRouteStop[] {
  if (stops.length < MIN_ROUTE_STOPS || stops.length > MAX_ROUTE_STOPS) {
    throw new RouteTopologyError(
      `A directional route must contain ${MIN_ROUTE_STOPS} to ${MAX_ROUTE_STOPS} stops`,
    );
  }

  if (new Set(stops.map((stop) => stop.stopId)).size !== stops.length) {
    throw new RouteTopologyError("A directional route cannot repeat a stop");
  }

  return stops.map((stop, position) => {
    const terminal = position === stops.length - 1;
    if (terminal && stop.travelDurationToNextMinutes !== null) {
      throw new RouteTopologyError(
        "The final RouteStop must not have travel time to a next stop",
      );
    }
    if (
      !terminal &&
      (!Number.isInteger(stop.travelDurationToNextMinutes) ||
        (stop.travelDurationToNextMinutes ?? 0) <= 0)
    ) {
      throw new RouteTopologyError(
        "Every non-final RouteStop requires a positive whole-minute travel duration",
      );
    }

    return Object.freeze({ ...stop, position });
  });
}
