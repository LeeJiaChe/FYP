import type {
  EtaFallbackReason,
  StudentBookingEta,
  TripEta,
} from "../contracts/eta.schemas";
import {
  calculateCumulativeLegEtas,
  calculateScheduleFallbackEtas,
  calculateTrafficImpactMinutes,
  DEFAULT_TRAFFIC_ETA_FAILURE_CACHE_MS,
  DEFAULT_TRAFFIC_ETA_MAX_LOCATION_AGE_MS,
  DEFAULT_TRAFFIC_ETA_TIMEOUT_MS,
  resolveRemainingStops,
  type OperationalTripStopSnapshot,
} from "../domain/eta-policy";
import {
  GoogleRoutesTrafficProvider,
  TrafficProviderError,
  type TrafficRouteProvider,
  type TrafficRouteResult,
} from "../infrastructure/google-routes.server";
import {
  EtaMemoryCache,
  sharedEtaCache,
  type EtaFailureThrottleReason,
} from "../infrastructure/eta-cache.server";
import {
  findBookingForEta,
  findTripForEta,
} from "../infrastructure/eta.prisma.server";
import { assertCoordinate, latestLocation } from "@/features/location/server";
import {
  forbidden,
  notFound,
} from "@/shared/application/application-error";
import { productPolicy, type ProductPolicy } from "@/shared/config/policies";
import { serverEnvironment } from "@/shared/config/env.server";
import { systemClock, type Clock } from "@/shared/time/clock";

export interface EtaActor {
  readonly userId: string;
  readonly role: string;
}

export interface TelemetryLocationSnapshot {
  readonly tripId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly recordedAt: Date;
  readonly source: "SIMULATED" | "GPS";
  readonly ageMs: number;
}

export interface TripForEtaSnapshot {
  readonly id: string;
  readonly status: string;
  readonly delayMinutes: number;
  readonly driverId?: string | null;
  readonly tripStops: readonly {
    readonly id: string;
    readonly stopId: string;
    readonly position: number;
    readonly stopCode: string;
    readonly stopName: string;
    readonly latitude: number | { toNumber(): number };
    readonly longitude: number | { toNumber(): number };
    readonly plannedArrival: Date;
    readonly actualArrival?: Date | null;
    readonly actualDeparture?: Date | null;
    readonly passedAt?: Date | null;
  }[];
}

export interface BookingForEtaSnapshot {
  readonly id: string;
  readonly studentId: string;
  readonly tripId: string;
  readonly status: string;
  readonly checkedInAt: Date | null;
  readonly actualAlightedAt: Date | null;
  readonly boardingTripStopId: string;
  readonly dropOffTripStopId: string;
  readonly boardingTripStop: {
    readonly id: string;
    readonly stopCode: string;
    readonly stopName: string;
    readonly position: number;
    readonly plannedArrival: Date;
    readonly actualArrival?: Date | null;
    readonly actualDeparture?: Date | null;
    readonly passedAt?: Date | null;
  };
  readonly dropOffTripStop: {
    readonly id: string;
    readonly stopCode: string;
    readonly stopName: string;
    readonly position: number;
    readonly plannedArrival: Date;
    readonly actualArrival?: Date | null;
    readonly actualDeparture?: Date | null;
    readonly passedAt?: Date | null;
  };
  readonly trip: {
    readonly id: string;
    readonly status: string;
    readonly delayMinutes: number;
    readonly driverId?: string | null;
  };
}

function tripStatusForResponse(status: string): TripEta["tripStatus"] {
  switch (status) {
    case "NOT_STARTED":
    case "BOARDING":
    case "DEPARTED":
    case "ARRIVED":
    case "CANCELLED":
      return status;
    default:
      throw new RangeError(`Unsupported Trip status: ${status}`);
  }
}

function currentLocationAgeMs(
  location: TelemetryLocationSnapshot,
  now: Date,
): number {
  return Math.max(0, now.getTime() - location.recordedAt.getTime());
}

function hasValidRouteCoordinates(
  location: Pick<TelemetryLocationSnapshot, "latitude" | "longitude"> | null,
  stops: readonly OperationalTripStopSnapshot[],
): boolean {
  try {
    if (location) assertCoordinate(location.latitude, location.longitude);
    for (const stop of stops) {
      assertCoordinate(stop.latitude, stop.longitude);
    }
    return true;
  } catch {
    return false;
  }
}

function assertValidTrafficRouteResult(
  result: TrafficRouteResult,
  expectedLegCount: number,
): void {
  if (
    !Number.isFinite(result.durationSeconds) ||
    result.durationSeconds < 0 ||
    !Number.isFinite(result.staticDurationSeconds) ||
    result.staticDurationSeconds < 0 ||
    !Number.isFinite(result.distanceMeters) ||
    result.distanceMeters < 0
  ) {
    throw new RangeError("Traffic provider returned invalid route metrics");
  }
  if (result.legs.length !== expectedLegCount) {
    throw new RangeError(
      `Expected ${expectedLegCount} route legs, received ${result.legs.length}`,
    );
  }
}

function normalizeCoordinates(
  stops: TripForEtaSnapshot["tripStops"],
): OperationalTripStopSnapshot[] {
  return stops.map((stop) => ({
    id: stop.id,
    position: stop.position,
    stopCode: stop.stopCode,
    stopName: stop.stopName,
    latitude:
      typeof stop.latitude === "number"
        ? stop.latitude
        : stop.latitude.toNumber(),
    longitude:
      typeof stop.longitude === "number"
        ? stop.longitude
        : stop.longitude.toNumber(),
    plannedArrival: stop.plannedArrival,
    actualArrival: stop.actualArrival,
    actualDeparture: stop.actualDeparture,
    passedAt: stop.passedAt,
  }));
}

function buildScheduleFallbackEta({
  trip,
  remainingStops,
  fallbackReason,
  now,
  location,
}: {
  trip: TripForEtaSnapshot;
  remainingStops: readonly OperationalTripStopSnapshot[];
  fallbackReason: EtaFallbackReason;
  now: Date;
  location?: TelemetryLocationSnapshot | null;
}): TripEta {
  const stopEstimates = calculateScheduleFallbackEtas({
    now,
    remainingStops,
    delayMinutes: trip.delayMinutes || 0,
  });

  return {
    tripId: trip.id,
    tripStatus: tripStatusForResponse(trip.status),
    source: "SCHEDULE_ESTIMATE",
    fallbackReason,
    locationSource: location?.source ?? null,
    locationRecordedAt: location?.recordedAt ? location.recordedAt.toISOString() : null,
    locationAgeMs: location ? currentLocationAgeMs(location, now) : null,
    generatedAt: now.toISOString(),
    trafficImpactMinutes: null,
    stopEstimates,
  };
}

export async function getTripEtaService({
  tripId,
  findTrip = findTripForEta,
  findLatestLocation = latestLocation,
  provider,
  cache = sharedEtaCache,
  clock = systemClock,
  policy = productPolicy,
  environment = serverEnvironment.googleTrafficEta,
}: {
  tripId: string;
  findTrip?: (tripId: string) => Promise<TripForEtaSnapshot | null>;
  findLatestLocation?: (
    tripId: string,
    clock?: Clock,
  ) => Promise<TelemetryLocationSnapshot | null>;
  provider?: TrafficRouteProvider;
  cache?: EtaMemoryCache;
  clock?: Clock;
  policy?: ProductPolicy;
  environment?: { enabled: boolean; apiKey: string };
}): Promise<TripEta> {
  const now = clock.now();
  const nowMs = now.getTime();

  // Concurrent callers may await the same active computation. Settled Google
  // results are never retained for reuse.
  const inFlight = cache.getInFlight(tripId);
  if (inFlight) return inFlight;

  const computePromise = (async () => {
    try {
      const trip = await findTrip(tripId);
      if (!trip) throw notFound("Trip not found");

      const normalizedStops = normalizeCoordinates(trip.tripStops);
      const { remainingStops } = resolveRemainingStops(
        trip.status,
        normalizedStops,
      );

      // Terminal or inactive trips are not eligible for live telemetry routing
      if (
        trip.status === "ARRIVED" ||
        trip.status === "CANCELLED" ||
        trip.status === "NOT_STARTED" ||
        remainingStops.length === 0
      ) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: null,
          now,
        });
      }

      if (!hasValidRouteCoordinates(null, remainingStops)) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "INVALID_ROUTE_DATA",
          now,
        });
      }

      if (!environment.enabled) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "DISABLED",
          now,
        });
      }

      if (!environment.apiKey) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "NO_API_KEY",
          now,
        });
      }

      const location = await findLatestLocation(tripId, clock);
      if (!location) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "NO_LOCATION",
          now,
        });
      }

      if (!hasValidRouteCoordinates(location, remainingStops)) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "INVALID_ROUTE_DATA",
          now,
          location,
        });
      }

      const maxAgeMs =
        policy.trafficEtaMaxLocationAgeMs ?? DEFAULT_TRAFFIC_ETA_MAX_LOCATION_AGE_MS;
      const locationAgeMs = currentLocationAgeMs(location, now);
      if (locationAgeMs > maxAgeMs) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "STALE_LOCATION",
          now,
          location,
        });
      }

      // Failure throttling retains only local classification and expiry metadata.
      // Authoritative configuration, Trip, route, and telemetry checks run first.
      const cachedFailure = cache.getCachedFailureReason(tripId, nowMs);
      if (cachedFailure) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: cachedFailure,
          now,
          location,
        });
      }

      const activeProvider =
        provider ?? new GoogleRoutesTrafficProvider(environment.apiKey);
      const timeoutMs =
        policy.trafficEtaTimeoutMs ?? DEFAULT_TRAFFIC_ETA_TIMEOUT_MS;
      const abortController = new AbortController();
      const timeoutTimer = setTimeout(() => {
        abortController.abort();
      }, timeoutMs);

      const destinationStop = remainingStops[remainingStops.length - 1]!;
      const intermediateStops = remainingStops.slice(
        0,
        remainingStops.length - 1,
      );

      try {
        const routeResult = await activeProvider.computeRemainingTripRoute(
          {
            origin: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
            destination: {
              latitude: destinationStop.latitude,
              longitude: destinationStop.longitude,
            },
            intermediates: intermediateStops.map((stop) => ({
              latitude: stop.latitude,
              longitude: stop.longitude,
            })),
          },
          abortController.signal,
        );
        assertValidTrafficRouteResult(routeResult, remainingStops.length);

        const responseNow = clock.now();

        const stopEstimates = calculateCumulativeLegEtas({
          generatedAt: responseNow,
          remainingStops,
          legs: routeResult.legs,
        });

        const trafficImpactMinutes = calculateTrafficImpactMinutes(
          routeResult.durationSeconds,
          routeResult.staticDurationSeconds,
        );

        const tripEta: TripEta = {
          tripId: trip.id,
          tripStatus: tripStatusForResponse(trip.status),
          source: "TRAFFIC_AWARE",
          fallbackReason: null,
          locationSource: location.source,
          locationRecordedAt: location.recordedAt.toISOString(),
          locationAgeMs: currentLocationAgeMs(location, responseNow),
          generatedAt: responseNow.toISOString(),
          trafficImpactMinutes,
          stopEstimates,
        };

        return tripEta;
      } catch (error) {
        const failureReason: EtaFailureThrottleReason = abortController.signal.aborted
          ? "API_TIMEOUT"
          : error instanceof TrafficProviderError && error.kind === "NO_ROUTE"
            ? "NO_ROUTE"
            : "API_ERROR";

        const failureNow = clock.now();

        const failureTtlMs =
          policy.trafficEtaFailureCacheMs ?? DEFAULT_TRAFFIC_ETA_FAILURE_CACHE_MS;
        cache.setCachedFailure(
          trip.id,
          failureReason,
          failureTtlMs,
          failureNow.getTime(),
        );

        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: failureReason,
          now: failureNow,
          location,
        });
      } finally {
        clearTimeout(timeoutTimer);
      }
    } finally {
      cache.clearInFlight(tripId);
    }
  })();

  cache.setInFlight(tripId, computePromise);
  return computePromise;
}

export async function getStudentBookingEtaService({
  actor,
  bookingId,
  findBooking = findBookingForEta,
  ...tripEtaOptions
}: {
  actor: EtaActor;
  bookingId: string;
  findBooking?: (bookingId: string) => Promise<BookingForEtaSnapshot | null>;
} & Omit<Parameters<typeof getTripEtaService>[0], "tripId">): Promise<StudentBookingEta> {
  const booking = await findBooking(bookingId);
  if (!booking) throw notFound("Booking not found");

  if (actor.role === "STUDENT" && booking.studentId !== actor.userId) {
    throw notFound("Booking not found");
  }

  if (actor.role !== "STUDENT" && actor.role !== "ADMIN") {
    throw forbidden("Unauthorized access to booking ETA");
  }

  const isBoarded = Boolean(booking.checkedInAt);
  const targetStopRole = isBoarded ? "DROP_OFF" : "BOARDING";
  const targetStop = isBoarded
    ? booking.dropOffTripStop
    : booking.boardingTripStop;

  const isPassed = Boolean(targetStop.passedAt || targetStop.actualDeparture);

  const tripEta = await getTripEtaService({
    ...tripEtaOptions,
    tripId: booking.tripId,
  });

  const matchingEstimate = tripEta.stopEstimates.find(
    (est) => est.tripStopId === targetStop.id,
  );

  return {
    bookingId: booking.id,
    tripId: booking.tripId,
    tripStatus: tripEta.tripStatus,
    targetStopId: targetStop.id,
    targetStopName: targetStop.stopName,
    targetStopRole,
    isBoarded,
    isPassed,
    minutesAway: isPassed ? null : (matchingEstimate?.minutesAway ?? null),
    estimatedArrival: isPassed
      ? null
      : (matchingEstimate?.estimatedArrival ?? null),
    plannedArrival: targetStop.plannedArrival.toISOString(),
    scheduleVarianceMinutes: isPassed
      ? null
      : (matchingEstimate?.scheduleVarianceMinutes ?? null),
    trafficImpactMinutes: tripEta.trafficImpactMinutes,
    source: tripEta.source,
    fallbackReason: tripEta.fallbackReason,
    locationSource: tripEta.locationSource,
    locationAgeMs: tripEta.locationAgeMs,
    generatedAt: tripEta.generatedAt,
  };
}

export async function getOperationalTripEtaService({
  actor,
  tripId,
  findTrip = findTripForEta,
  ...tripEtaOptions
}: {
  actor: EtaActor;
  tripId: string;
  findTrip?: (tripId: string) => Promise<TripForEtaSnapshot | null>;
} & Omit<Parameters<typeof getTripEtaService>[0], "tripId">): Promise<TripEta> {
  if (actor.role === "STUDENT") {
    throw forbidden("Admin or assigned Driver required");
  }

  if (actor.role === "DRIVER") {
    const trip = await findTrip(tripId);
    if (!trip) throw notFound("Trip not found");
    if (trip.driverId !== actor.userId) {
      throw forbidden("Assigned Driver required");
    }
  }

  return getTripEtaService({
    ...tripEtaOptions,
    tripId,
    findTrip,
  });
}
