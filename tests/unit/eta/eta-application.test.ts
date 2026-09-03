import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTripEtaService,
  getStudentBookingEtaService,
  getOperationalTripEtaService,
} from "../../../src/features/eta/application/eta";
import { FakeTrafficRouteProvider } from "../../../src/features/eta/infrastructure/google-routes.server";
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

  it("serves repeated requests within cache TTL from in-memory cache", async () => {
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
        policy: createProductPolicy({ trafficEtaCacheMs: 45_000 }),
        environment: { enabled: true, apiKey: "valid-key" },
      });

    // Request 1: cache miss, provider called
    const first = await fetchEta();
    assert.equal(provider.callCount, 1);
    assert.equal(first.source, "TRAFFIC_AWARE");

    // Request 2 (20 seconds later, within 45s TTL): cache hit, provider NOT called
    currentInstant = "2026-09-04T10:05:20.000Z";
    const second = await fetchEta();
    assert.equal(provider.callCount, 1);
    assert.deepEqual(second, first);

    // Request 3 (50 seconds later, past 45s TTL): cache expired, provider called again
    currentInstant = "2026-09-04T10:05:50.000Z";
    await fetchEta();
    assert.equal(provider.callCount, 2);
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
