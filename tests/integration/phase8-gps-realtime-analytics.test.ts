import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { after, before, describe, it } from "node:test";

import { routeNoShowRates, routeUtilization } from "../../src/features/analytics/application/analytics";
import {
  ingestLocation,
  latestLocation,
  retainRecentLocations,
  simulateLocation,
} from "../../src/features/location/application/location";
import { issueTripSubscription } from "../../src/features/realtime/application/subscriptions";
import { scheduleTrip } from "../../src/features/trips/application/schedule-trip";
import { ApplicationError } from "../../src/shared/application/application-error";
import { prisma } from "../../src/shared/db/prisma.server";

const require = createRequire(import.meta.url);
const { verifySubscriptionToken } = require("../../realtime/server.js") as {
  verifySubscriptionToken: (token: string, secret: string) => { room: string } | null;
};
const suffix = randomUUID().slice(0, 8).toUpperCase();
const created = { tripId: "", routeId: "", busId: "", stopIds: [] as string[], userIds: [] as string[] };
const fixed = (instant: Date) => ({ now: () => new Date(instant) });
let departure: Date;

before(async () => {
  const admin = await prisma.user.create({ data: { name: "Phase 8 Admin", email: `p8-admin-${suffix}@test.dev`, passwordHash: "test", role: "ADMIN" } });
  const driver = await prisma.user.create({ data: { name: "Phase 8 Driver", email: `p8-driver-${suffix}@test.dev`, passwordHash: "test", role: "DRIVER" } });
  const student = await prisma.user.create({ data: { name: "Phase 8 Student", email: `p8-student-${suffix}@student.tarc.edu.my`, studentId: `P8${suffix}`, passwordHash: "test", role: "STUDENT" } });
  const student2 = await prisma.user.create({ data: { name: "Phase 8 Student 2", email: `p8-student2-${suffix}@student.tarc.edu.my`, studentId: `Q8${suffix}`, passwordHash: "test", role: "STUDENT" } });
  created.userIds.push(admin.id, driver.id, student.id, student2.id);
  const stops = await Promise.all([0, 1, 2].map((position) => prisma.stop.create({
    data: { code: `P8_${suffix}_${position}`, name: `Phase 8 Stop ${position}`, latitude: 3.2 + position * 0.01, longitude: 101.7 + position * 0.01 },
  })));
  created.stopIds.push(...stops.map((stop) => stop.id));
  const route = await prisma.route.create({ data: { name: `Phase 8 Route ${suffix}`, routeStops: { create: stops.map((stop, position) => ({ stopId: stop.id, position, travelDurationToNextMinutes: position === 2 ? null : 5 })) } } });
  created.routeId = route.id;
  const bus = await prisma.bus.create({ data: { plateNumber: `P8-${suffix}`, seatedCapacity: 2, standingCapacity: 2, status: "ACTIVE" } });
  created.busId = bus.id;
  departure = new Date(Date.now() + 60 * 60 * 1_000);
  const trip = await scheduleTrip(
    { userId: admin.id, role: "ADMIN" },
    { routeId: route.id, busId: bus.id, driverId: driver.id, departureTime: departure.toISOString() },
    fixed(new Date(departure.getTime() - 60 * 60 * 1_000)),
  );
  created.tripId = trip.id;
  const snapshot = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: { tripStops: { orderBy: { position: "asc" } }, tripSegments: { orderBy: { position: "asc" } }, tripSeats: { orderBy: { seatNumber: "asc" } } } });
  await prisma.trip.update({ where: { id: trip.id }, data: { status: "BOARDING" } });
  await prisma.tripStop.update({ where: { id: snapshot.tripStops[0]!.id }, data: { actualArrival: new Date() } });

  const booking = await prisma.booking.create({ data: { studentId: student.id, tripId: trip.id, tripSeatId: snapshot.tripSeats[0]!.id, boardingTripStopId: snapshot.tripStops[0]!.id, dropOffTripStopId: snapshot.tripStops[2]!.id, checkedInAt: new Date(), checkInMethod: "QR" } });
  await prisma.reservedSeatSegment.createMany({ data: snapshot.tripSegments.map((segment) => ({ id: randomUUID(), bookingId: booking.id, tripId: trip.id, tripSeatId: snapshot.tripSeats[0]!.id, tripSegmentId: segment.id })) });
  await prisma.booking.create({ data: { studentId: student2.id, tripId: trip.id, tripSeatId: snapshot.tripSeats[1]!.id, boardingTripStopId: snapshot.tripStops[0]!.id, dropOffTripStopId: snapshot.tripStops[1]!.id, status: "NO_SHOW" } });
  const intent = await prisma.walkInIntent.create({ data: { studentId: student2.id, tripId: trip.id, boardingTripStopId: snapshot.tripStops[1]!.id, dropOffTripStopId: snapshot.tripStops[2]!.id, status: "BOARDED", expiresAt: new Date(departure.getTime() + 60 * 60 * 1_000) } });
  const journey = await prisma.walkInJourney.create({ data: { walkInIntentId: intent.id, studentId: student2.id, tripId: trip.id, boardingTripStopId: snapshot.tripStops[1]!.id, dropOffTripStopId: snapshot.tripStops[2]!.id, boardedAt: new Date(), boardingMethod: "QR" } });
  await prisma.standingSegmentClaim.create({ data: { id: randomUUID(), walkInJourneyId: journey.id, tripId: trip.id, tripSegmentId: snapshot.tripSegments[1]!.id } });
});

after(async () => {
  await prisma.tripLocationSample.deleteMany({ where: { tripId: created.tripId } });
  await prisma.standingSegmentClaim.deleteMany({ where: { tripId: created.tripId } });
  await prisma.walkInJourney.deleteMany({ where: { tripId: created.tripId } });
  await prisma.walkInIntent.deleteMany({ where: { tripId: created.tripId } });
  await prisma.reservedSeatSegment.deleteMany({ where: { tripId: created.tripId } });
  await prisma.booking.deleteMany({ where: { tripId: created.tripId } });
  await prisma.tripSeat.deleteMany({ where: { tripId: created.tripId } });
  await prisma.tripSegment.deleteMany({ where: { tripId: created.tripId } });
  await prisma.tripStop.deleteMany({ where: { tripId: created.tripId } });
  await prisma.trip.deleteMany({ where: { id: created.tripId } });
  await prisma.routeStop.deleteMany({ where: { routeId: created.routeId } });
  await prisma.route.deleteMany({ where: { id: created.routeId } });
  await prisma.stop.deleteMany({ where: { id: { in: created.stopIds } } });
  await prisma.bus.deleteMany({ where: { id: created.busId } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.$disconnect();
});

describe("Phase 8 PostgreSQL telemetry and removal", () => {
  it("persists source-neutral simulated/GPS telemetry and returns newest recorded sample", async () => {
    const now = new Date();
    await ingestLocation({ tripId: created.tripId, latitude: 3.21, longitude: 101.71, recordedAt: new Date(now.getTime() - 1_000).toISOString(), source: "SIMULATED" }, fixed(now));
    await ingestLocation({ tripId: created.tripId, latitude: 3.22, longitude: 101.72, recordedAt: now.toISOString(), source: "GPS" }, fixed(now));
    const latest = await latestLocation(created.tripId, fixed(new Date(now.getTime() + 500)));
    assert.equal(latest?.source, "GPS");
    assert.equal(latest?.latitude, 3.22);
    const simulated = await simulateLocation(created.tripId, fixed(now));
    assert.equal(simulated.source, "SIMULATED");
  });

  it("enforces coordinate/FK constraints and rejects terminal Trip telemetry", async () => {
    await assert.rejects(prisma.tripLocationSample.create({ data: { id: randomUUID(), tripId: created.tripId, latitude: 91, longitude: 0, recordedAt: new Date(), source: "SIMULATED" } }));
    await assert.rejects(prisma.tripLocationSample.create({ data: { id: randomUUID(), tripId: randomUUID(), latitude: 0, longitude: 0, recordedAt: new Date(), source: "GPS" } }));
    await prisma.trip.update({ where: { id: created.tripId }, data: { status: "ARRIVED" } });
    await assert.rejects(
      ingestLocation({ tripId: created.tripId, latitude: 3.2, longitude: 101.7, recordedAt: new Date().toISOString(), source: "GPS" }),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
    await prisma.trip.update({ where: { id: created.tripId }, data: { status: "BOARDING" } });
  });

  it("retains exactly seven days and legacy Seat/device tables no longer exist", async () => {
    const now = new Date();
    const oldId = randomUUID();
    const recentId = randomUUID();
    await prisma.tripLocationSample.createMany({ data: [
      { id: oldId, tripId: created.tripId, latitude: 3.2, longitude: 101.7, recordedAt: new Date(now.getTime() - 8 * 86_400_000), source: "SIMULATED" },
      { id: recentId, tripId: created.tripId, latitude: 3.2, longitude: 101.7, recordedAt: new Date(now.getTime() - 6 * 86_400_000), source: "SIMULATED" },
    ] });
    await retainRecentLocations(fixed(now));
    assert.equal(await prisma.tripLocationSample.count({ where: { id: oldId } }), 0);
    assert.equal(await prisma.tripLocationSample.count({ where: { id: recentId } }), 1);
    const tables = await prisma.$queryRaw<Array<{ seat: string | null; device: string | null }>>`
      SELECT to_regclass('"Seat"')::text AS seat, to_regclass('"DeviceStatusLog"')::text AS device
    `;
    assert.deepEqual(tables[0], { seat: null, device: null });
    assert.equal(await prisma.tripSeat.count({ where: { tripId: created.tripId } }), 2);
  });
});

describe("Phase 8 analytics and realtime authorization", () => {
  it("uses seated/standing segment denominators and authoritative no-show outcomes", async () => {
    const range = { from: new Date(departure.getTime() - 86_400_000), to: new Date(departure.getTime() + 86_400_000) };
    const utilization = (await routeUtilization({ role: "ADMIN" }, range)).find((row) => row.routeId === created.routeId)!;
    assert.equal(utilization.seatedCapacitySegments, 4);
    assert.equal(utilization.reservedSeatSegments, 2);
    assert.equal(utilization.seatedUtilizationRate, 50);
    assert.equal(utilization.standingCapacitySegments, 4);
    assert.equal(utilization.standingSegmentClaims, 1);
    assert.equal(utilization.standingUtilizationRate, 25);
    const noShows = (await routeNoShowRates({ role: "ADMIN" }, range)).find((row) => row.routeId === created.routeId)!;
    assert.equal(noShows.totalNoShows, 1);
    assert.equal(noShows.noShowRate, 50);
  });

  it("issues a signed Trip-scoped subscription which cannot be forged", async () => {
    const subscription = await issueTripSubscription({ userId: created.userIds[2]!, role: "STUDENT" }, created.tripId);
    const secret = process.env.REALTIME_SERVICE_SECRET!;
    assert.equal(verifySubscriptionToken(subscription.token, secret)?.room, `trip:${created.tripId}`);
    assert.equal(verifySubscriptionToken(`${subscription.token}tampered`, secret), null);
  });
});
