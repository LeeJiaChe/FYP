import type {
  EtaFallbackReason,
  StudentBookingEta,
  TripEta,
} from "../contracts/eta.schemas";
import {
  calculateCumulativeLegEtas,
  calculateScheduleFallbackEtas,
  calculateTrafficImpactMinutes,
  DEFAULT_TRAFFIC_ETA_CACHE_MS,
  DEFAULT_TRAFFIC_ETA_FAILURE_CACHE_MS,
  DEFAULT_TRAFFIC_ETA_MAX_LOCATION_AGE_MS,
  DEFAULT_TRAFFIC_ETA_TIMEOUT_MS,
  resolveRemainingStops,
  type OperationalTripStopSnapshot,
} from "../domain/eta-policy";
import {
  GoogleRoutesTrafficProvider,
  type TrafficRouteProvider,
} from "../infrastructure/google-routes.server";
import {
  EtaMemoryCache,
  sharedEtaCache,
} from "../infrastructure/eta-cache.server";
import {
  findBookingForEta,
  findTripForEta,
} from "../infrastructure/eta.prisma.server";
import { latestLocation } from "@/features/location/server";
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
    source: "SCHEDULE_ESTIMATE",
    fallbackReason,
    locationSource: location?.source ?? null,
    locationRecordedAt: location?.recordedAt ? location.recordedAt.toISOString() : null,
    locationAgeMs: location?.ageMs ?? null,
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

  // 1. Check in-memory success cache
  const cachedEta = cache.getCachedTripEta(tripId, nowMs);
  if (cachedEta) return cachedEta;

  // 2. Check in-flight deduplication
  const inFlight = cache.getInFlight(tripId);
  if (inFlight) return inFlight;

  // 3. Initiate new fetch and register in-flight
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

      // 4. Check failure cache throttle
      const cachedFailure = cache.getCachedFailureReason(tripId, nowMs);
      if (cachedFailure) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: cachedFailure,
          now,
        });
      }

      // 5. Check configuration
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

      // 6. Check location telemetry
      const location = await findLatestLocation(tripId, clock);
      if (!location) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "NO_LOCATION",
          now,
        });
      }

      const maxAgeMs =
        policy.trafficEtaMaxLocationAgeMs ?? DEFAULT_TRAFFIC_ETA_MAX_LOCATION_AGE_MS;
      if (location.ageMs > maxAgeMs) {
        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: "STALE_LOCATION",
          now,
          location,
        });
      }

      // 7. Execute Google Routes call with timeout
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
        clearTimeout(timeoutTimer);

        const stopEstimates = calculateCumulativeLegEtas({
          generatedAt: now,
          remainingStops,
          legs: routeResult.legs,
        });

        const trafficImpactMinutes = calculateTrafficImpactMinutes(
          routeResult.durationSeconds,
          routeResult.staticDurationSeconds,
        );

        const tripEta: TripEta = {
          tripId: trip.id,
          source: "TRAFFIC_AWARE",
          fallbackReason: null,
          locationSource: location.source,
          locationRecordedAt: location.recordedAt.toISOString(),
          locationAgeMs: location.ageMs,
          generatedAt: now.toISOString(),
          trafficImpactMinutes,
          stopEstimates,
        };

        const cacheTtlMs =
          policy.trafficEtaCacheMs ?? DEFAULT_TRAFFIC_ETA_CACHE_MS;
        cache.setCachedTripEta(trip.id, tripEta, cacheTtlMs, nowMs);

        return tripEta;
      } catch (error) {
        clearTimeout(timeoutTimer);
        const isTimeout =
          abortController.signal.aborted ||
          (error instanceof Error && /timed out/i.test(error.message));
        const failureReason: EtaFallbackReason = isTimeout
          ? "API_TIMEOUT"
          : "API_ERROR";

        const failureTtlMs =
          policy.trafficEtaFailureCacheMs ?? DEFAULT_TRAFFIC_ETA_FAILURE_CACHE_MS;
        cache.setCachedFailure(trip.id, failureReason, failureTtlMs, nowMs);

        return buildScheduleFallbackEta({
          trip,
          remainingStops,
          fallbackReason: failureReason,
          now,
          location,
        });
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
