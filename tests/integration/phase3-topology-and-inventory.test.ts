import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { randomUUID } from "node:crypto";

import { scheduleTrip } from "../../src/features/trips/application/schedule-trip";
import { prisma } from "../../src/shared/db/prisma.server";

const suffix = randomUUID().slice(0, 8).toUpperCase();

let busId: string;
let routeId: string;
let driverId: string;
let stopIds: string[];
let tripId: string;

async function cleanPhase3Fixtures() {
  await prisma.seat.deleteMany({ where: { trip: { routeId } } });
  await prisma.tripSeat.deleteMany({ where: { trip: { routeId } } });
  await prisma.tripSegment.deleteMany({ where: { trip: { routeId } } });
  await prisma.tripStop.deleteMany({ where: { trip: { routeId } } });
  await prisma.trip.deleteMany({ where: { routeId } });
  await prisma.routeStop.deleteMany({ where: { routeId } });
  if (routeId) await prisma.route.deleteMany({ where: { id: routeId } });
  if (stopIds?.length) {
    await prisma.stop.deleteMany({ where: { id: { in: stopIds } } });
  }
  if (busId) await prisma.bus.deleteMany({ where: { id: busId } });
  if (driverId) await prisma.user.deleteMany({ where: { id: driverId } });
}

before(async () => {
  const [stopA, stopB, stopC] = await Promise.all(
    [
      [`${suffix}_A`, "Integration Stop A", 3.2, 101.7],
      [`${suffix}_B`, "Integration Stop B", 3.21, 101.71],
      [`${suffix}_C`, "Integration Stop C", 3.22, 101.72],
    ].map(([code, name, latitude, longitude]) =>
      prisma.stop.create({
        data: {
          code: String(code),
          name: String(name),
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
      }),
    ),
  );
  stopIds = [stopA.id, stopB.id, stopC.id];

  const bus = await prisma.bus.create({
    data: {
      plateNumber: `TEST-${suffix}`,
      seatedCapacity: 4,
      standingCapacity: 2,
      status: "ACTIVE",
    },
  });
  busId = bus.id;
  const driver = await prisma.user.create({
    data: {
      name: "Phase 3 Driver",
      email: `driver-${suffix.toLowerCase()}@tarumt.edu.my`,
      passwordHash: "integration-only",
      role: "DRIVER",
    },
  });
  driverId = driver.id;
  const route = await prisma.route.create({
    data: {
      name: `Integration Route ${suffix}`,
      routeStops: {
        create: [
          { stopId: stopA.id, position: 0, travelDurationToNextMinutes: 7 },
          { stopId: stopB.id, position: 1, travelDurationToNextMinutes: 9 },
          { stopId: stopC.id, position: 2, travelDurationToNextMinutes: null },
        ],
      },
    },
  });
  routeId = route.id;
});

after(async () => {
  await cleanPhase3Fixtures();
  await prisma.$disconnect();
});

describe("Phase 3 PostgreSQL constraints", () => {
  it("rejects invalid Stop coordinates and Bus capacities", async () => {
    await assert.rejects(
      prisma.stop.create({
        data: {
          code: `${suffix}_BAD_LAT`,
          name: "Invalid latitude",
          latitude: 90.000001,
          longitude: 0,
        },
      }),
    );
    await assert.rejects(
      prisma.stop.create({
        data: {
          code: `${suffix}_BAD_LON`,
          name: "Invalid longitude",
          latitude: 0,
          longitude: -180.000001,
        },
      }),
    );
    await assert.rejects(
      prisma.bus.create({
        data: {
          plateNumber: `BAD-${suffix}`,
          seatedCapacity: 0,
          standingCapacity: -1,
        },
      }),
    );
  });

  it("protects RouteStop position and Stop identities", async () => {
    await assert.rejects(
      prisma.routeStop.create({
        data: {
          routeId,
          stopId: stopIds[2]!,
          position: 0,
          travelDurationToNextMinutes: 5,
        },
      }),
    );
    await assert.rejects(
      prisma.routeStop.create({
        data: {
          routeId,
          stopId: stopIds[0]!,
          position: 8,
          travelDurationToNextMinutes: null,
        },
      }),
    );
  });
});

describe("Phase 3 Trip creation", () => {
  it("creates capacity/topology snapshots and exact segment/seat inventory", async () => {
    const departure = new Date(Date.now() + 24 * 60 * 60 * 1_000);
    const trip = await scheduleTrip(
      { userId: randomUUID(), role: "ADMIN" },
      {
        routeId,
        busId,
        driverId,
        departureTime: departure.toISOString(),
      },
      { now: () => new Date(departure.getTime() - 60 * 60 * 1_000) },
    );
    tripId = trip.id;

    assert.equal(trip.seatedCapacity, 4);
    assert.equal(trip.standingCapacity, 2);
    assert.equal(trip.tripStops.length, 3);
    assert.equal(trip.tripSegments.length, 2);
    assert.equal(trip.tripSeats.length, 4);
    assert.deepEqual(
      trip.tripSeats.map((seat) => seat.seatNumber),
      [1, 2, 3, 4],
    );
    assert.deepEqual(
      trip.tripStops.map((stop) => stop.plannedDeparture.getTime() - departure.getTime()),
      [0, 7 * 60 * 1_000, 16 * 60 * 1_000],
    );
    assert.equal(
      await prisma.seat.count({ where: { tripId, tripSeatId: { not: null } } }),
      4,
      "temporary legacy Seat mirrors must map one-to-one to TripSeat",
    );
  });

  it("keeps historical snapshots independent from later Bus, RouteStop, and Stop edits", async () => {
    const before = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: {
        tripStops: { orderBy: { position: "asc" } },
        tripSegments: { orderBy: { position: "asc" } },
      },
    });

    await prisma.bus.update({
      where: { id: busId },
      data: { seatedCapacity: 8, standingCapacity: 5 },
    });
    const routeStops = await prisma.routeStop.findMany({
      where: { routeId },
      orderBy: { position: "asc" },
    });
    await prisma.$transaction([
      prisma.routeStop.update({
        where: { id: routeStops[0]!.id },
        data: { position: 99 },
      }),
      prisma.routeStop.update({
        where: { id: routeStops[1]!.id },
        data: { position: 0, travelDurationToNextMinutes: 3 },
      }),
      prisma.routeStop.update({
        where: { id: routeStops[0]!.id },
        data: { position: 1, travelDurationToNextMinutes: 4 },
      }),
    ]);
    await prisma.stop.update({
      where: { id: stopIds[0] },
      data: {
        name: "Renamed source Stop",
        latitude: 4.5,
        longitude: 102.5,
      },
    });

    const after = await prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: {
        tripStops: { orderBy: { position: "asc" } },
        tripSegments: { orderBy: { position: "asc" } },
      },
    });
    assert.equal(after.seatedCapacity, before.seatedCapacity);
    assert.equal(after.standingCapacity, before.standingCapacity);
    assert.deepEqual(
      after.tripStops.map((stop) => ({
        position: stop.position,
        name: stop.stopName,
        latitude: stop.latitude.toString(),
        longitude: stop.longitude.toString(),
        plannedDeparture: stop.plannedDeparture,
      })),
      before.tripStops.map((stop) => ({
        position: stop.position,
        name: stop.stopName,
        latitude: stop.latitude.toString(),
        longitude: stop.longitude.toString(),
        plannedDeparture: stop.plannedDeparture,
      })),
    );
    assert.deepEqual(
      after.tripSegments.map((segment) => ({
        position: segment.position,
        from: segment.fromTripStopId,
        to: segment.toTripStopId,
      })),
      before.tripSegments.map((segment) => ({
        position: segment.position,
        from: segment.fromTripStopId,
        to: segment.toTripStopId,
      })),
    );
  });

  it("protects duplicate TripSeat identity under concurrent inserts", async () => {
    const seatNumber = 99;
    const attempts = await Promise.allSettled([
      prisma.tripSeat.create({ data: { tripId, seatNumber } }),
      prisma.tripSeat.create({ data: { tripId, seatNumber } }),
    ]);
    assert.equal(
      attempts.filter((attempt) => attempt.status === "fulfilled").length,
      1,
    );
    assert.equal(
      attempts.filter((attempt) => attempt.status === "rejected").length,
      1,
    );
    await prisma.tripSeat.deleteMany({ where: { tripId, seatNumber } });
  });
});
