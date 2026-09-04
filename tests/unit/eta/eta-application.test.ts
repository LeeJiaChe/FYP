import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTripEtaService,
  getStudentBookingEtaService,
  getOperationalTripEtaService,
} from "../../../src/features/eta/application/eta";
import {
  FakeTrafficRouteProvider,
  TrafficProviderError,
} from "../../../src/features/eta/infrastructure/google-routes.server";
import { EtaMemoryCache } from "../../../src/features/eta/infrastructure/eta-cache.server";
import { fixedClock } from "../../../src/shared/time/clock";
import { createProductPolicy } from "../../../src/shared/config/policies";

function makeSampleTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: "trip-101",
    status: "DEPARTED",
    delayMinutes: 3,
    driverId: "driver-1",
    tripStops: [
      {
        id: "00000000-0000-0000-0000-000000000001",
        stopId: "stop-0",
        position: 0,
        stopCode: "TAR_GATE_7",
        stopName: "TAR UMT Gate 7",
        latitude: 3.215,
        longitude: 101.726,
        plannedArrival: new Date("2026-09-04T10:00:00.000Z"),
        actualArrival: new Date("2026-09-04T09:55:00.000Z"),
        actualDeparture: new Date("2026-09-04T10:02:00.000Z"),
        passedAt: null,
      },
      {
        id: "00000000-0000-0000-0000-000000000002",
        stopId: "stop-1",
        position: 1,
        stopCode: "PV18",
        stopName: "PV18",
        latitude: 3.209,
        longitude: 101.712,
        plannedArrival: new Date("2026-09-04T10:10:00.000Z"),
        actualArrival: null,
        actualDeparture: null,
        passedAt: null,
      },
      {
        id: "00000000-0000-0000-0000-000000000003",
        stopId: "stop-2",
        position: 2,
        stopCode: "TERMINAL",
        stopName: "Terminal",
        latitude: 3.201,
        longitude: 101.717,
        plannedArrival: new Date("2026-09-04T10:20:00.000Z"),
        actualArrival: null,
        actualDeparture: null,
        passedAt: null,
      },
    ],
    ...overrides,
  };
}

function makeSampleBooking(overrides: Record<string, unknown> = {}) {
  const trip = makeSampleTrip();
  return {
    id: "booking-201",
    studentId: "student-user-1",
    tripId: trip.id,
    status: "CONFIRMED",
    checkedInAt: null,
    actualAlightedAt: null,
    boardingTripStopId: trip.tripStops[1]!.id,
    dropOffTripStopId: trip.tripStops[2]!.id,
    boardingTripStop: trip.tripStops[1]!,
    dropOffTripStop: trip.tripStops[2]!,
    trip,
    ...overrides,
  };
}

describe("ETA Application Service - Core traffic and fallback rules", () => {
  it("falls back to SCHEDULE_ESTIMATE with NO_LOCATION when trip has no telemetry", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => null,
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(provider.callCount, 0);
    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, "NO_LOCATION");
    assert.equal(result.locationSource, null);
    assert.equal(result.stopEstimates.length, 2);
  });

  it("falls back to SCHEDULE_ESTIMATE with STALE_LOCATION when sample age > maxLocationAgeMs", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    // Location sample recorded 90 seconds ago (> 60s policy)
    const recordedAt = new Date("2026-09-04T10:03:30.000Z");

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => ({
        tripId: trip.id,
        latitude: 3.212,
        longitude: 101.72,
        recordedAt,
        source: "SIMULATED",
        ageMs: 90_000,
      }),
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(provider.callCount, 0);
    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, "STALE_LOCATION");
    assert.equal(result.locationSource, "SIMULATED");
    assert.equal(result.locationAgeMs, 90_000);
  });

  it("calls Google Routes API provider when telemetry is fresh and integration is enabled", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider({
      durationSeconds: 360,
      staticDurationSeconds: 300,
      distanceMeters: 3000,
      legs: [
        { durationSeconds: 120, staticDurationSeconds: 100, distanceMeters: 1000 },
        { durationSeconds: 240, staticDurationSeconds: 200, distanceMeters: 2000 },
      ],
    });
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => ({
        tripId: trip.id,
        latitude: 3.212,
        longitude: 101.72,
        recordedAt: new Date("2026-09-04T10:04:45.000Z"),
        source: "SIMULATED",
        ageMs: 15_000,
      }),
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(provider.callCount, 1);
    assert.equal(result.source, "TRAFFIC_AWARE");
    assert.equal(result.fallbackReason, null);
    assert.equal(result.locationSource, "SIMULATED");
    assert.equal(result.trafficImpactMinutes, 1); // (360 - 300) / 60 = 1 min
    assert.equal(result.stopEstimates.length, 2);
    // Stop 1: PV18 (leg 1 = 120s = 2 min away from 10:05 = 10:07)
    assert.equal(result.stopEstimates[0]!.stopCode, "PV18");
    assert.equal(result.stopEstimates[0]!.minutesAway, 2);
    assert.equal(result.stopEstimates[0]!.estimatedArrival, "2026-09-04T10:07:00.000Z");
  });

  it("does not reuse a completed Google result after the in-flight request settles", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    let currentInstant = "2026-09-04T10:05:00.000Z";

    const fetchEta = () =>
      getTripEtaService({
        tripId: trip.id,
        findTrip: async () => trip,
        findLatestLocation: async () => ({
          tripId: trip.id,
          latitude: 3.212,
          longitude: 101.72,
          recordedAt: new Date("2026-09-04T10:04:55.000Z"),
          source: "GPS",
          ageMs: 5_000,
        }),
        provider,
        cache,
        clock: fixedClock(currentInstant),
        policy: createProductPolicy(),
        environment: { enabled: true, apiKey: "valid-key" },
      });

    const first = await fetchEta();
    assert.equal(provider.callCount, 1);
    assert.equal(first.source, "TRAFFIC_AWARE");

    // A later request performs a fresh provider call; no completed result is cached.
    currentInstant = "2026-09-04T10:05:20.000Z";
    const second = await fetchEta();
    assert.equal(provider.callCount, 2);
    assert.equal(second.source, "TRAFFIC_AWARE");
    assert.notEqual(second.generatedAt, first.generatedAt);
  });

  it("deduplicates concurrent in-flight requests for the same trip", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    provider.delayMs = 25; // Introduce artificial provider latency
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const fetchEta = () =>
      getTripEtaService({
        tripId: trip.id,
        findTrip: async () => trip,
        findLatestLocation: async () => ({
          tripId: trip.id,
          latitude: 3.212,
          longitude: 101.72,
          recordedAt: new Date("2026-09-04T10:04:55.000Z"),
          source: "SIMULATED",
          ageMs: 5_000,
        }),
        provider,
        cache,
        clock,
        policy: createProductPolicy(),
        environment: { enabled: true, apiKey: "valid-key" },
      });

    // Launch 3 concurrent requests simultaneously
    const [res1, res2, res3] = await Promise.all([fetchEta(), fetchEta(), fetchEta()]);

    assert.equal(provider.callCount, 1);
    assert.equal(res1.source, "TRAFFIC_AWARE");
    assert.equal(res2.source, "TRAFFIC_AWARE");
    assert.equal(res3.source, "TRAFFIC_AWARE");
  });

  it("throttles failures via failure cache backoff without hammering provider", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    provider.cannedError = new Error("Google API 500 internal error");
    const cache = new EtaMemoryCache();
    let currentInstant = "2026-09-04T10:05:00.000Z";

    const fetchEta = () =>
      getTripEtaService({
        tripId: trip.id,
        findTrip: async () => trip,
        findLatestLocation: async () => ({
          tripId: trip.id,
          latitude: 3.212,
          longitude: 101.72,
          recordedAt: new Date("2026-09-04T10:04:55.000Z"),
          source: "SIMULATED",
          ageMs: 5_000,
        }),
        provider,
        cache,
        clock: fixedClock(currentInstant),
        policy: createProductPolicy({ trafficEtaFailureCacheMs: 15_000 }),
        environment: { enabled: true, apiKey: "valid-key" },
      });

    // First call: provider fails -> returns schedule fallback with API_ERROR
    const first = await fetchEta();
    assert.equal(provider.callCount, 1);
    assert.equal(first.source, "SCHEDULE_ESTIMATE");
    assert.equal(first.fallbackReason, "API_ERROR");

    // Second call 5 seconds later (within 15s failure TTL) -> returns fallback without calling provider
    currentInstant = "2026-09-04T10:05:05.000Z";
    const second = await fetchEta();
    assert.equal(provider.callCount, 1);
    assert.equal(second.source, "SCHEDULE_ESTIMATE");
    assert.equal(second.fallbackReason, "API_ERROR");
  });

  it("does not call Google Routes API for terminal ARRIVED or CANCELLED trips", async () => {
    const arrivedTrip = makeSampleTrip({ status: "ARRIVED" });
    const cancelledTrip = makeSampleTrip({ status: "CANCELLED" });
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const resArrived = await getTripEtaService({
      tripId: arrivedTrip.id,
      findTrip: async () => arrivedTrip,
      findLatestLocation: async () => null,
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    const resCancelled = await getTripEtaService({
      tripId: cancelledTrip.id,
      findTrip: async () => cancelledTrip,
      findLatestLocation: async () => null,
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(provider.callCount, 0);
    assert.equal(resArrived.source, "SCHEDULE_ESTIMATE");
    assert.equal(resCancelled.source, "SCHEDULE_ESTIMATE");
    assert.equal(resArrived.tripStatus, "ARRIVED");
    assert.equal(resCancelled.tripStatus, "CANCELLED");
    assert.equal(resArrived.stopEstimates.length, 0);
    assert.equal(resCancelled.stopEstimates.length, 0);
  });

  it("uses a schedule estimate without calling Google for NOT_STARTED trips", async () => {
    const trip = makeSampleTrip({ status: "NOT_STARTED" });
    const provider = new FakeTrafficRouteProvider();
    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => locationForNotStartedShouldNotRun(),
      provider,
      cache: new EtaMemoryCache(),
      clock: fixedClock("2026-09-04T10:05:00.000Z"),
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(provider.callCount, 0);
    assert.equal(result.tripStatus, "NOT_STARTED");
    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, null);

    function locationForNotStartedShouldNotRun(): never {
      throw new Error("Location lookup must not run for NOT_STARTED Trip");
    }
  });
});

describe("ETA Application Service - Student and Admin authorization & journeys", () => {
  it("allows student to access their own booking and targets boarding stop before check-in", async () => {
    const booking = makeSampleBooking({ checkedInAt: null });
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const result = await getStudentBookingEtaService({
      actor: { userId: "student-user-1", role: "STUDENT" },
      bookingId: booking.id,
      findBooking: async () => booking,
      findTrip: async () => booking.trip,
      findLatestLocation: async () => ({
        tripId: booking.tripId,
        latitude: 3.212,
        longitude: 101.72,
        recordedAt: new Date("2026-09-04T10:04:55.000Z"),
        source: "SIMULATED",
        ageMs: 5_000,
      }),
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(result.bookingId, booking.id);
    assert.equal(result.targetStopId, booking.boardingTripStopId);
    assert.equal(result.targetStopName, "PV18");
    assert.equal(result.targetStopRole, "BOARDING");
    assert.equal(result.isBoarded, false);
    assert.equal(result.isPassed, false);
    assert.ok(result.minutesAway !== null);
  });

  it("targets drop-off stop after student has checked in", async () => {
    const booking = makeSampleBooking({
      checkedInAt: new Date("2026-09-04T10:02:00.000Z"),
    });
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const result = await getStudentBookingEtaService({
      actor: { userId: "student-user-1", role: "STUDENT" },
      bookingId: booking.id,
      findBooking: async () => booking,
      findTrip: async () => booking.trip,
      findLatestLocation: async () => ({
        tripId: booking.tripId,
        latitude: 3.212,
        longitude: 101.72,
        recordedAt: new Date("2026-09-04T10:04:55.000Z"),
        source: "SIMULATED",
        ageMs: 5_000,
      }),
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(result.targetStopId, booking.dropOffTripStopId);
    assert.equal(result.targetStopName, "Terminal");
    assert.equal(result.targetStopRole, "DROP_OFF");
    assert.equal(result.isBoarded, true);
  });

  it("rejects unauthorized student trying to access another student's booking", async () => {
    const booking = makeSampleBooking({ studentId: "student-user-1" });
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    await assert.rejects(
      () =>
        getStudentBookingEtaService({
          actor: { userId: "other-student-99", role: "STUDENT" },
          bookingId: booking.id,
          findBooking: async () => booking,
          findTrip: async () => booking.trip,
          findLatestLocation: async () => null,
          provider,
          cache,
          clock,
          policy: createProductPolicy(),
          environment: { enabled: true, apiKey: "valid-key" },
        }),
      /Booking not found/i,
    );
  });

  it("allows admin to view operational trip ETA but forbids student", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    // Student actor rejected with 403 forbidden
    await assert.rejects(
      () =>
        getOperationalTripEtaService({
          actor: { userId: "student-user-1", role: "STUDENT" },
          tripId: trip.id,
          findTrip: async () => trip,
          findLatestLocation: async () => null,
          provider,
          cache,
          clock,
          policy: createProductPolicy(),
          environment: { enabled: true, apiKey: "valid-key" },
        }),
      (error: unknown) => {
        const appError = error as { code?: string; message?: string };
        assert.equal(appError.code, "FORBIDDEN");
        assert.match(appError.message ?? "", /Admin or assigned Driver required/i);
        return true;
      },
    );

    // Admin actor succeeds
    const adminResult = await getOperationalTripEtaService({
      actor: { userId: "admin-1", role: "ADMIN" },
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => null,
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(adminResult.tripId, trip.id);
  });

  it("passes remaining stops to provider in exact authoritative order without passed stops", async () => {
    // 4 stops: A (passed), B (passed), C (unpassed), D (unpassed)
    const trip = {
      id: "trip-4-stops",
      status: "DEPARTED",
      delayMinutes: 0,
      tripStops: [
        {
          id: "stop-a",
          stopId: "stop-a",
          position: 0,
          stopCode: "STOP_A",
          stopName: "Stop A",
          latitude: 3.21,
          longitude: 101.71,
          plannedArrival: new Date("2026-09-04T10:00:00Z"),
          actualArrival: new Date("2026-09-04T10:00:00Z"),
          actualDeparture: new Date("2026-09-04T10:02:00Z"),
          passedAt: new Date("2026-09-04T10:02:00Z"),
        },
        {
          id: "stop-b",
          stopId: "stop-b",
          position: 1,
          stopCode: "STOP_B",
          stopName: "Stop B",
          latitude: 3.22,
          longitude: 101.72,
          plannedArrival: new Date("2026-09-04T10:10:00Z"),
          actualArrival: new Date("2026-09-04T10:09:00Z"),
          actualDeparture: new Date("2026-09-04T10:11:00Z"),
          passedAt: new Date("2026-09-04T10:11:00Z"),
        },
        {
          id: "stop-c",
          stopId: "stop-c",
          position: 2,
          stopCode: "STOP_C",
          stopName: "Stop C",
          latitude: 3.23,
          longitude: 101.73,
          plannedArrival: new Date("2026-09-04T10:20:00Z"),
          actualArrival: null,
          actualDeparture: null,
          passedAt: null,
        },
        {
          id: "stop-d",
          stopId: "stop-d",
          position: 3,
          stopCode: "STOP_D",
          stopName: "Stop D",
          latitude: 3.24,
          longitude: 101.74,
          plannedArrival: new Date("2026-09-04T10:30:00Z"),
          actualArrival: null,
          actualDeparture: null,
          passedAt: null,
        },
      ],
    };

    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:12:00.000Z");

    await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => ({
        tripId: trip.id,
        latitude: 3.225,
        longitude: 101.725,
        recordedAt: new Date("2026-09-04T10:11:55.000Z"),
        source: "GPS",
        ageMs: 5_000,
      }),
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(provider.callCount, 1);
    // Origin is shuttle location
    assert.deepEqual(provider.lastRequest?.origin, {
      latitude: 3.225,
      longitude: 101.725,
    });
    // Intermediate is stop C only (stop A and B omitted)
    assert.deepEqual(provider.lastRequest?.intermediates, [
      { latitude: 3.23, longitude: 101.73 },
    ]);
    // Destination is stop D (terminal)
    assert.deepEqual(provider.lastRequest?.destination, {
      latitude: 3.24,
      longitude: 101.74,
    });
  });

  it("falls back to SCHEDULE_ESTIMATE with DISABLED when GOOGLE_TRAFFIC_ETA_ENABLED is false", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => ({
        tripId: trip.id,
        latitude: 3.212,
        longitude: 101.72,
        recordedAt: new Date("2026-09-04T10:04:55.000Z"),
        source: "SIMULATED",
        ageMs: 5_000,
      }),
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: false, apiKey: "some-key" },
    });

    assert.equal(provider.callCount, 0);
    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, "DISABLED");
  });

  it("falls back to SCHEDULE_ESTIMATE with NO_API_KEY when key is empty while enabled", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:05:00.000Z");

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => ({
        tripId: trip.id,
        latitude: 3.212,
        longitude: 101.72,
        recordedAt: new Date("2026-09-04T10:04:55.000Z"),
        source: "SIMULATED",
        ageMs: 5_000,
      }),
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "" },
    });

    assert.equal(provider.callCount, 0);
    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, "NO_API_KEY");
  });

  it("marks student journey as isPassed when boarding stop has already departed", async () => {
    const trip = makeSampleTrip();
    // Mark boarding stop (PV18) as already departed
    const passedBoardingStop = {
      ...trip.tripStops[1]!,
      actualDeparture: new Date("2026-09-04T10:12:00Z"),
      passedAt: new Date("2026-09-04T10:12:00Z"),
    };
    const booking = makeSampleBooking({
      boardingTripStop: passedBoardingStop,
      checkedInAt: null,
    });

    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const clock = fixedClock("2026-09-04T10:15:00.000Z");

    const result = await getStudentBookingEtaService({
      actor: { userId: "student-user-1", role: "STUDENT" },
      bookingId: booking.id,
      findBooking: async () => booking,
      findTrip: async () => trip,
      findLatestLocation: async () => null,
      provider,
      cache,
      clock,
      policy: createProductPolicy(),
      environment: { enabled: true, apiKey: "valid-key" },
    });

    assert.equal(result.isPassed, true);
    assert.equal(result.minutesAway, null);
    assert.equal(result.estimatedArrival, null);
  });
});

describe("ETA Application Service - stabilization regressions", () => {
  const environment = { enabled: true, apiKey: "valid-key" };
  const locationFor = (tripId: string, recordedAt = "2026-09-04T10:04:55.000Z") => ({
    tripId,
    latitude: 3.212,
    longitude: 101.72,
    recordedAt: new Date(recordedAt),
    source: "GPS" as const,
    ageMs: 5_000,
  });

  it("maps a typed zero-route provider failure to NO_ROUTE schedule fallback", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider();
    provider.cannedError = new TrafficProviderError("NO_ROUTE", "No route");

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => locationFor(trip.id),
      provider,
      cache: new EtaMemoryCache(),
      clock: fixedClock("2026-09-04T10:05:00.000Z"),
      policy: createProductPolicy(),
      environment,
    });

    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, "NO_ROUTE");
  });

  it("maps an aborted provider request to API_TIMEOUT without string matching", async () => {
    const trip = makeSampleTrip({ id: "timeout-trip" });
    const provider = new FakeTrafficRouteProvider();
    provider.delayMs = 30;

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => locationFor(trip.id),
      provider,
      cache: new EtaMemoryCache(),
      clock: fixedClock("2026-09-04T10:05:00.000Z"),
      policy: createProductPolicy({ trafficEtaTimeoutMs: 5 }),
      environment,
    });

    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, "API_TIMEOUT");
  });

  it("rejects provider results with too few or too many legs", async () => {
    for (const legCount of [1, 3]) {
      const trip = makeSampleTrip({ id: `trip-leg-count-${legCount}` });
      const leg = {
        durationSeconds: 120,
        staticDurationSeconds: 100,
        distanceMeters: 1_000,
      };
      const provider = new FakeTrafficRouteProvider({
        durationSeconds: 240,
        staticDurationSeconds: 200,
        distanceMeters: 2_000,
        legs: Array.from({ length: legCount }, () => leg),
      });

      const result = await getTripEtaService({
        tripId: trip.id,
        findTrip: async () => trip,
        findLatestLocation: async () => locationFor(trip.id),
        provider,
        cache: new EtaMemoryCache(),
        clock: fixedClock("2026-09-04T10:05:00.000Z"),
        policy: createProductPolicy(),
        environment,
      });

      assert.equal(result.source, "SCHEDULE_ESTIMATE");
      assert.equal(result.fallbackReason, "API_ERROR");
    }
  });

  it("rejects non-finite or negative provider metrics", async () => {
    const trip = makeSampleTrip();
    const provider = new FakeTrafficRouteProvider({
      durationSeconds: Number.NaN,
      staticDurationSeconds: 200,
      distanceMeters: -1,
      legs: [
        { durationSeconds: 120, staticDurationSeconds: 100, distanceMeters: 1_000 },
        { durationSeconds: 120, staticDurationSeconds: 100, distanceMeters: 1_000 },
      ],
    });

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => locationFor(trip.id),
      provider,
      cache: new EtaMemoryCache(),
      clock: fixedClock("2026-09-04T10:05:00.000Z"),
      policy: createProductPolicy(),
      environment,
    });

    assert.equal(result.source, "SCHEDULE_ESTIMATE");
    assert.equal(result.fallbackReason, "API_ERROR");
  });

  it("does not call the provider for invalid origin or TripStop coordinates", async () => {
    const invalidCases = [
      {
        trip: makeSampleTrip({ id: "invalid-origin" }),
        location: { ...locationFor("invalid-origin"), latitude: 999 },
      },
      {
        trip: makeSampleTrip({ id: "nan-origin" }),
        location: { ...locationFor("nan-origin"), longitude: Number.NaN },
      },
      {
        trip: makeSampleTrip({
          id: "invalid-stop",
          tripStops: makeSampleTrip().tripStops.map((stop, index) =>
            index === 1 ? { ...stop, latitude: 999 } : stop,
          ),
        }),
        location: locationFor("invalid-stop"),
      },
    ];

    for (const testCase of invalidCases) {
      const provider = new FakeTrafficRouteProvider();
      const result = await getTripEtaService({
        tripId: testCase.trip.id,
        findTrip: async () => testCase.trip,
        findLatestLocation: async () => testCase.location,
        provider,
        cache: new EtaMemoryCache(),
        clock: fixedClock("2026-09-04T10:05:00.000Z"),
        policy: createProductPolicy(),
        environment,
      });

      assert.equal(provider.callCount, 0);
      assert.equal(result.source, "SCHEDULE_ESTIMATE");
      assert.equal(result.fallbackReason, "INVALID_ROUTE_DATA");
    }
  });

  it("re-reads ARRIVED and CANCELLED state after a traffic result", async () => {
    for (const terminalStatus of ["ARRIVED", "CANCELLED"] as const) {
      let trip = makeSampleTrip({ id: `state-${terminalStatus}` });
      const provider = new FakeTrafficRouteProvider();
      const cache = new EtaMemoryCache();
      const options = {
        tripId: trip.id,
        findTrip: async () => trip,
        findLatestLocation: async () => locationFor(trip.id),
        provider,
        cache,
        clock: fixedClock("2026-09-04T10:05:00.000Z"),
        policy: createProductPolicy(),
        environment,
      };

      assert.equal((await getTripEtaService(options)).source, "TRAFFIC_AWARE");
      trip = makeSampleTrip({ id: trip.id, status: terminalStatus });
      const terminal = await getTripEtaService(options);

      assert.equal(provider.callCount, 1);
      assert.equal(terminal.source, "SCHEDULE_ESTIMATE");
      assert.equal(terminal.tripStatus, terminalStatus);
      assert.equal(terminal.stopEstimates.length, 0);
    }
  });

  it("re-reads stop progression and starts the next route at the new remaining stop", async () => {
    let trip = makeSampleTrip({ id: "progression-trip" });
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    const options = {
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => locationFor(trip.id),
      provider,
      cache,
      clock: fixedClock("2026-09-04T10:05:00.000Z"),
      policy: createProductPolicy(),
      environment,
    };

    const first = await getTripEtaService(options);
    assert.equal(first.stopEstimates[0]?.stopCode, "PV18");

    trip = makeSampleTrip({
      id: trip.id,
      tripStops: makeSampleTrip().tripStops.map((stop, index) =>
        index === 1
          ? {
              ...stop,
              actualDeparture: new Date("2026-09-04T10:05:00.000Z"),
              passedAt: new Date("2026-09-04T10:05:00.000Z"),
            }
          : stop,
      ),
    });
    const second = await getTripEtaService(options);

    assert.equal(provider.callCount, 2);
    assert.equal(second.stopEstimates.length, 1);
    assert.equal(second.stopEstimates[0]?.stopCode, "TERMINAL");
    assert.deepEqual(provider.lastRequest?.intermediates, []);
  });

  it("does not let a previous success bypass later stale-location policy", async () => {
    const trip = makeSampleTrip({ id: "stale-after-success" });
    const provider = new FakeTrafficRouteProvider();
    const cache = new EtaMemoryCache();
    let currentInstant = "2026-09-04T10:05:00.000Z";
    const fetchEta = () =>
      getTripEtaService({
        tripId: trip.id,
        findTrip: async () => trip,
        findLatestLocation: async () => locationFor(trip.id),
        provider,
        cache,
        clock: fixedClock(currentInstant),
        policy: createProductPolicy(),
        environment,
      });

    assert.equal((await fetchEta()).source, "TRAFFIC_AWARE");
    currentInstant = "2026-09-04T10:06:10.000Z";
    const stale = await fetchEta();

    assert.equal(provider.callCount, 1);
    assert.equal(stale.source, "SCHEDULE_ESTIMATE");
    assert.equal(stale.fallbackReason, "STALE_LOCATION");
    assert.equal(stale.locationAgeMs, 75_000);
  });

  it("uses the provider response-time clock for traffic arrivals and freshness", async () => {
    const trip = makeSampleTrip({ id: "response-clock" });
    const instants = [
      new Date("2026-09-04T10:05:00.000Z"),
      new Date("2026-09-04T10:05:03.000Z"),
    ];
    let clockCall = 0;
    const clock = {
      now: () => new Date(instants[Math.min(clockCall++, instants.length - 1)]!),
    };

    const result = await getTripEtaService({
      tripId: trip.id,
      findTrip: async () => trip,
      findLatestLocation: async () => locationFor(trip.id),
      provider: new FakeTrafficRouteProvider(),
      cache: new EtaMemoryCache(),
      clock,
      policy: createProductPolicy(),
      environment,
    });

    assert.equal(result.generatedAt, "2026-09-04T10:05:03.000Z");
    assert.equal(result.stopEstimates[0]?.estimatedArrival, "2026-09-04T10:07:03.000Z");
    assert.equal(result.locationAgeMs, 8_000);
  });
});
