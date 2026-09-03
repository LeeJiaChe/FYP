import "server-only";

import { parseGoogleDurationSeconds } from "../domain/eta-policy";

export interface LatLngCoordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export interface TrafficRouteRequest {
  readonly origin: LatLngCoordinate;
  readonly destination: LatLngCoordinate;
  readonly intermediates: readonly LatLngCoordinate[];
}

export interface RouteLegResult {
  readonly durationSeconds: number;
  readonly staticDurationSeconds: number;
  readonly distanceMeters: number;
}

export interface TrafficRouteResult {
  readonly durationSeconds: number;
  readonly staticDurationSeconds: number;
  readonly distanceMeters: number;
  readonly legs: readonly RouteLegResult[];
}

export interface TrafficRouteProvider {
  computeRemainingTripRoute(
    request: TrafficRouteRequest,
    signal?: AbortSignal,
  ): Promise<TrafficRouteResult>;
}

const GOOGLE_ROUTES_ENDPOINT =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const REQUIRED_FIELD_MASK = [
  "routes.duration",
  "routes.staticDuration",
  "routes.distanceMeters",
  "routes.legs.duration",
  "routes.legs.staticDuration",
  "routes.legs.distanceMeters",
].join(",");

export class GoogleRoutesTrafficProvider implements TrafficRouteProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("Google Routes API key must not be empty");
    }
  }

  async computeRemainingTripRoute(
    request: TrafficRouteRequest,
    signal?: AbortSignal,
  ): Promise<TrafficRouteResult> {
    const payload = {
      origin: {
        location: {
          latLng: {
            latitude: request.origin.latitude,
            longitude: request.origin.longitude,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: request.destination.latitude,
            longitude: request.destination.longitude,
          },
        },
      },
      intermediates: request.intermediates.map((stop) => ({
        location: {
          latLng: {
            latitude: stop.latitude,
            longitude: stop.longitude,
          },
        },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      // Shuttle stop sequence is authoritative; waypoint reordering is forbidden.
      optimizeWaypointOrder: false,
    };

    let response: Response;
    try {
      response = await fetch(GOOGLE_ROUTES_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": REQUIRED_FIELD_MASK,
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new Error("Google Routes API request timed out");
      }
      throw new Error(
        `Google Routes API network request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    if (!response.ok) {
      const status = response.status;
      // Never include request headers or API key in error messages.
      throw new Error(`Google Routes API returned HTTP status ${status}`);
    }

    const json = (await response.json()) as {
      routes?: Array<{
        duration?: string;
        staticDuration?: string;
        distanceMeters?: number;
        legs?: Array<{
          duration?: string;
          staticDuration?: string;
          distanceMeters?: number;
        }>;
      }>;
    };

    const firstRoute = json.routes?.[0];
    if (!firstRoute || !firstRoute.duration) {
      throw new Error("Google Routes API returned no valid route");
    }

    const durationSeconds = parseGoogleDurationSeconds(firstRoute.duration);
    const staticDurationSeconds = firstRoute.staticDuration
      ? parseGoogleDurationSeconds(firstRoute.staticDuration)
      : durationSeconds;
    const distanceMeters = firstRoute.distanceMeters ?? 0;

    const legs: RouteLegResult[] = (firstRoute.legs ?? []).map((leg) => {
      const legDuration = leg.duration
        ? parseGoogleDurationSeconds(leg.duration)
        : 0;
      const legStaticDuration = leg.staticDuration
        ? parseGoogleDurationSeconds(leg.staticDuration)
        : legDuration;
      return {
        durationSeconds: legDuration,
        staticDurationSeconds: legStaticDuration,
        distanceMeters: leg.distanceMeters ?? 0,
      };
    });

    return {
      durationSeconds,
      staticDurationSeconds,
      distanceMeters,
      legs,
    };
  }
}

/**
 * Fake provider for unit and deterministic integration tests.
 */
export class FakeTrafficRouteProvider implements TrafficRouteProvider {
  public callCount = 0;
  public lastRequest: TrafficRouteRequest | null = null;
  public cannedResult: TrafficRouteResult | null = null;
  public cannedError: Error | null = null;
  public delayMs = 0;

  constructor(initialResult?: TrafficRouteResult) {
    if (initialResult) this.cannedResult = initialResult;
  }

  async computeRemainingTripRoute(
    request: TrafficRouteRequest,
    signal?: AbortSignal,
  ): Promise<TrafficRouteResult> {
    this.callCount += 1;
    this.lastRequest = request;

    if (this.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, this.delayMs);
        if (signal) {
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("Google Routes API request timed out"));
          });
        }
      });
    }

    if (signal?.aborted) {
      throw new Error("Google Routes API request timed out");
    }

    if (this.cannedError) {
      throw this.cannedError;
    }

    if (this.cannedResult) {
      return this.cannedResult;
    }

    // Default synthetic route: 120 seconds per leg
    const totalLegs = request.intermediates.length + 1;
    const legs: RouteLegResult[] = Array.from({ length: totalLegs }, () => ({
      durationSeconds: 120,
      staticDurationSeconds: 100,
      distanceMeters: 1000,
    }));

    return {
      durationSeconds: totalLegs * 120,
      staticDurationSeconds: totalLegs * 100,
      distanceMeters: totalLegs * 1000,
      legs,
    };
  }
}
