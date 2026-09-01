import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";

import {
  createBus,
  createRoute,
  createStop,
  retireRoute,
  retireStop,
  updateBus,
  updateRoute,
} from "../../src/features/fleet/application/manage-topology";
import {
  cancelTrip,
  createServiceBlock,
  scheduleTrip,
  updateScheduledTrip,
} from "../../src/features/trips/application/schedule-trip";
import { ApplicationError } from "../../src/shared/application/application-error";
import { listDrivers } from "../../src/features/identity/application/manage-drivers";
import { prisma } from "../../src/shared/db/prisma.server";

const created = {
  tripIds: [] as string[],
  routeIds: [] as string[],
  stopIds: [] as string[],
  busIds: [] as string[],
  userIds: [] as string[],
  lineIds: [] as string[],
  blockIds: [] as string[],
};

const fixed = (instant: Date) => ({ now: () => new Date(instant) });

async function user(role: "ADMIN" | "DRIVER" | "STUDENT", label: string) {
  const suffix = randomUUID();
  const record = await prisma.user.create({
    data: {
      name: `Phase 7 ${label}`,
      email: `${label.toLowerCase().replaceAll(" ", "-")}-${suffix}@phase7.test`,
      studentId: role === "STUDENT" ? suffix.slice(0, 8).toUpperCase() : null,
      passwordHash: "integration-only",
      role,
    },
  });
  created.userIds.push(record.id);
  return record;
}

async function scenario(options: { busStatus?: "ACTIVE" | "MAINTENANCE" | "RETIRED"; driverId?: string } = {}) {
  const admin = await user("ADMIN", "Admin");
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const line = await prisma.serviceLine.create({
    data: { code: `P7_${suffix}`, name: `Phase 7 Line ${suffix}` },
  });
  created.lineIds.push(line.id);
  const stops = [];
  for (let position = 0; position < 3; position += 1) {
    const stop = await createStop(
      { userId: admin.id, role: "ADMIN" },
      {
        code: `P7_${suffix}_${position}`,
        name: `Phase 7 ${suffix} Stop ${position}`,
        latitude: 3.2 + position / 100,
        longitude: 101.7 + position / 100,
      },
    );
    created.stopIds.push(stop.id);
    stops.push(stop);
  }
  const route = await createRoute(
    { userId: admin.id, role: "ADMIN" },
    {
      lineId: line.id,
      direction: "OUTBOUND",
      name: `Phase 7 Route ${suffix}`,
      stops: stops.map((stop, position) => ({
        stopId: stop.id,
        travelDurationToNextMinutes: position === 2 ? null : 8 + position,
      })),
    },
  );
  created.routeIds.push(route.id);
  const bus = await createBus(
    { userId: admin.id, role: "ADMIN" },
    {
      plateNumber: `P7-${suffix}`,
      seatedCapacity: 2,
      standingCapacity: 2,
      status: options.busStatus ?? "ACTIVE",
    },
  );
  created.busIds.push(bus.id);
  const departure = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  return { admin, bus, line, route, stops, departure, driverId: options.driverId };
}

async function schedule(value: Awaited<ReturnType<typeof scenario>>, overrides: { busId?: string; driverId?: string; departure?: Date } = {}) {
  const departure = overrides.departure ?? value.departure;
  const trip = await scheduleTrip(
    { userId: value.admin.id, role: "ADMIN" },
    {
      routeId: value.route.id,
      busId: overrides.busId ?? value.bus.id,
      driverId: overrides.driverId ?? value.driverId,
      departureTime: departure.toISOString(),
    },
    fixed(new Date(departure.getTime() - 60 * 60 * 1_000)),
  );
  created.tripIds.push(trip.id);
  return trip;
}

after(async () => {
  await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } });
  await prisma.penaltyAppeal.deleteMany({ where: { studentId: { in: created.userIds } } });
  await prisma.penalty.deleteMany({ where: { studentId: { in: created.userIds } } });
  await prisma.standingSegmentClaim.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.walkInJourney.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.walkInIntent.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripStatusHistory.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.reservedSeatSegment.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.waitlistEntry.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.booking.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripSeat.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripSegment.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripStop.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } });
  await prisma.serviceBlock.deleteMany({ where: { id: { in: created.blockIds } } });
  await prisma.routeStop.deleteMany({ where: { routeId: { in: created.routeIds } } });
  await prisma.route.deleteMany({ where: { id: { in: created.routeIds } } });
  await prisma.serviceLine.deleteMany({ where: { id: { in: created.lineIds } } });
  await prisma.stop.deleteMany({ where: { id: { in: created.stopIds } } });
  await prisma.bus.deleteMany({ where: { id: { in: created.busIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.$disconnect();
});

describe("Phase 7 PostgreSQL fleet and scheduling", () => {
  it("rejects inactive Stops and invalid directional topology", async () => {
    const value = await scenario();
    const inactive = await createStop(
      { userId: value.admin.id, role: "ADMIN" },
      { code: `INACTIVE_${randomUUID().slice(0, 6)}`, name: "Inactive", latitude: 3, longitude: 101 },
    );
    created.stopIds.push(inactive.id);
    await retireStop({ userId: value.admin.id, role: "ADMIN" }, inactive.id);
    await assert.rejects(
      createRoute(
        { userId: value.admin.id, role: "ADMIN" },
        { lineId: value.line.id, direction: "INBOUND", name: `Invalid ${randomUUID()}`, stops: [
          { stopId: inactive.id, travelDurationToNextMinutes: 5 },
          { stopId: value.stops[0]!.id, travelDurationToNextMinutes: null },
        ] },
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "VALIDATION",
    );
    await assert.rejects(
      createRoute(
        { userId: value.admin.id, role: "ADMIN" },
        { lineId: value.line.id, direction: "INBOUND", name: "Bad topology", stops: [
          { stopId: value.stops[0]!.id, travelDurationToNextMinutes: null },
          { stopId: value.stops[1]!.id, travelDurationToNextMinutes: null },
        ] },
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "VALIDATION",
    );
  });

  it("preserves Trip topology and capacity snapshots after asset edits", async () => {
    const value = await scenario();
    const trip = await schedule(value);
    const before = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: { tripStops: { orderBy: { position: "asc" } }, tripSegments: true, tripSeats: true } });
    await updateBus({ userId: value.admin.id, role: "ADMIN" }, { id: value.bus.id, seatedCapacity: 9, standingCapacity: 7 });
    await updateRoute({ userId: value.admin.id, role: "ADMIN" }, {
      id: value.route.id,
      name: `${value.route.name} edited`,
      stops: [
        { stopId: value.stops[0]!.id, travelDurationToNextMinutes: 2 },
        { stopId: value.stops[2]!.id, travelDurationToNextMinutes: 3 },
        { stopId: value.stops[1]!.id, travelDurationToNextMinutes: null },
      ],
    });
    const after = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: { tripStops: { orderBy: { position: "asc" } }, tripSegments: true, tripSeats: true } });
    assert.equal(after.seatedCapacity, before.seatedCapacity);
    assert.equal(after.standingCapacity, before.standingCapacity);
    assert.deepEqual(after.tripStops.map((stop) => [stop.position, stop.stopCode, stop.plannedDeparture]), before.tripStops.map((stop) => [stop.position, stop.stopCode, stop.plannedDeparture]));
    assert.deepEqual(after.tripSegments.map((segment) => [segment.position, segment.fromTripStopId, segment.toTripStopId]), before.tripSegments.map((segment) => [segment.position, segment.fromTripStopId, segment.toTripStopId]));
    assert.equal(after.tripSeats.length, before.tripSeats.length);
  });

  it("rejects unavailable Buses and non-DRIVER assignments", async () => {
    for (const busStatus of ["MAINTENANCE", "RETIRED"] as const) {
      const value = await scenario({ busStatus });
      await assert.rejects(schedule(value), (error: unknown) => error instanceof ApplicationError && error.code === "NOT_FOUND");
    }
    const student = await user("STUDENT", "Not Driver");
    const value = await scenario({ driverId: student.id });
    await assert.rejects(schedule(value), (error: unknown) => error instanceof ApplicationError && error.code === "VALIDATION");
    const admin = await user("ADMIN", "Also Not Driver");
    const adminValue = await scenario({ driverId: admin.id });
    await assert.rejects(schedule(adminValue), (error: unknown) => error instanceof ApplicationError && error.code === "VALIDATION");
  });

  it("models Lines, directional Trips, and same-Bus ServiceBlocks without permanent Driver ownership", async () => {
    const firstDriver = await user("DRIVER", "Block Driver A");
    const secondDriver = await user("DRIVER", "Block Driver B");
    const value = await scenario({ driverId: firstDriver.id });
    const inverse = await createRoute(
      { userId: value.admin.id, role: "ADMIN" },
      {
        lineId: value.line.id,
        direction: "INBOUND",
        name: `${value.route.name} Inbound`,
        stops: [...value.stops].reverse().map((stop, position) => ({
          stopId: stop.id,
          travelDurationToNextMinutes: position === value.stops.length - 1 ? null : 8,
        })),
      },
    );
    created.routeIds.push(inverse.id);
    const block = await createServiceBlock(
      { userId: value.admin.id, role: "ADMIN" },
      {
        code: `BLOCK-${randomUUID().slice(0, 8).toUpperCase()}`,
        serviceDate: value.departure.toISOString().slice(0, 10),
        busId: value.bus.id,
      },
    );
    created.blockIds.push(block.id);

    const outbound = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: value.route.id,
        busId: value.bus.id,
        driverId: firstDriver.id,
        blockId: block.id,
        departureTime: value.departure.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(outbound.id);
    const inbound = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: inverse.id,
        busId: value.bus.id,
        driverId: secondDriver.id,
        blockId: block.id,
        departureTime: outbound.estimatedArrivalTime.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(inbound.id);

    const line = await prisma.serviceLine.findUniqueOrThrow({
      where: { id: value.line.id },
      include: { routes: { orderBy: { direction: "asc" } } },
    });
    assert.deepEqual(new Set(line.routes.map((route) => route.direction)), new Set(["OUTBOUND", "INBOUND"]));
    const stored = await prisma.serviceBlock.findUniqueOrThrow({
      where: { id: block.id },
      include: { trips: { orderBy: { blockSequence: "asc" } } },
    });
    assert.deepEqual(stored.trips.map((trip) => trip.busId), [value.bus.id, value.bus.id]);
    assert.deepEqual(stored.trips.map((trip) => trip.driverId), [firstDriver.id, secondDriver.id]);
    assert.deepEqual(stored.trips.map((trip) => trip.blockSequence), [1, 2]);

    const other = await scenario();
    const parallelDriver = await user("DRIVER", "Parallel Driver");
    const parallel = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: value.route.id,
        busId: other.bus.id,
        driverId: parallelDriver.id,
        departureTime: value.departure.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(parallel.id);

    await assert.rejects(
      scheduleTrip(
        { userId: value.admin.id, role: "ADMIN" },
        {
          routeId: value.route.id,
          busId: other.bus.id,
          blockId: block.id,
          departureTime: new Date(inbound.estimatedArrivalTime.getTime() + 60_000).toISOString(),
        },
        fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT",
    );

    const cancelledDeparture = new Date(inbound.estimatedArrivalTime.getTime() + 60 * 60 * 1_000);
    const cancelled = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: value.route.id,
        busId: other.bus.id,
        departureTime: cancelledDeparture.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(cancelled.id);
    await cancelTrip(
      { userId: value.admin.id, role: "ADMIN" },
      cancelled.id,
      { reason: "Integration replacement" },
    );
    const replacement = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: value.route.id,
        busId: other.bus.id,
        departureTime: cancelledDeparture.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(replacement.id);
    await assert.rejects(
      prisma.trip.update({
        where: { id: inbound.id },
        data: { blockSequence: 1 },
      }),
    );

    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('Bus', 'Route')
         AND column_name IN ('assignedDriverId', 'defaultDriverId', 'driverId', 'routeId', 'lineId')
       ORDER BY table_name, column_name
    `;
    assert.deepEqual(columns, [{ table_name: "Route", column_name: "lineId" }]);
  });

  it("serializes Bus and Driver overlap conflicts", async () => {
    const value = await scenario();
    const busAttempts = await Promise.allSettled([schedule(value), schedule(value)]);
    assert.equal(busAttempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(busAttempts.filter((attempt) => attempt.status === "rejected").length, 1);
    const driver = await user("DRIVER", "Conflict Driver");
    const firstDriverTrip = await scenario({ driverId: driver.id });
    const secondDriverTrip = await scenario({ driverId: driver.id });
    const driverAttempt = await Promise.allSettled([schedule(firstDriverTrip), schedule(secondDriverTrip)]);
    assert.equal(driverAttempt.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(driverAttempt.filter((attempt) => attempt.status === "rejected").length, 1);
  });

  it("cancels a future Trip and all pending passenger state when its Bus becomes unavailable", async () => {
    const value = await scenario();
    const trip = await schedule(value);
    const [studentA, studentB, studentC] = await Promise.all([
      user("STUDENT", "Booked"), user("STUDENT", "Waiting"), user("STUDENT", "Walkin"),
    ]);
    const booking = await prisma.booking.create({
      data: {
        studentId: studentA.id,
        tripId: trip.id,
        tripSeatId: trip.tripSeats[0]!.id,
        boardingTripStopId: trip.tripStops[0]!.id,
        dropOffTripStopId: trip.tripStops[2]!.id,
      },
    });
    await prisma.reservedSeatSegment.createMany({
      data: trip.tripSegments.map((segment) => ({
        bookingId: booking.id,
        tripId: trip.id,
        tripSeatId: trip.tripSeats[0]!.id,
        tripSegmentId: segment.id,
      })),
    });
    await prisma.waitlistEntry.create({ data: { studentId: studentB.id, tripId: trip.id, boardingTripStopId: trip.tripStops[0]!.id, dropOffTripStopId: trip.tripStops[2]!.id } });
    await prisma.walkInIntent.create({ data: { studentId: studentC.id, tripId: trip.id, boardingTripStopId: trip.tripStops[0]!.id, dropOffTripStopId: trip.tripStops[1]!.id, expiresAt: value.departure } });

    await updateBus({ userId: value.admin.id, role: "ADMIN" }, { id: value.bus.id, status: "MAINTENANCE" });
    assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status, "CANCELLED");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "CANCELLED");
    assert.equal(await prisma.reservedSeatSegment.count({ where: { bookingId: booking.id } }), 0);
    assert.equal(await prisma.waitlistEntry.count({ where: { tripId: trip.id, status: "CANCELLED" } }), 1);
    assert.equal(await prisma.walkInIntent.count({ where: { tripId: trip.id, status: "CANCELLED" } }), 1);
    assert.equal(await prisma.penalty.count({ where: { bookingId: booking.id } }), 0);
    assert.equal(await prisma.tripStatusHistory.count({ where: { tripId: trip.id, toStatus: "CANCELLED" } }), 1);
    assert.equal(await prisma.notification.count({ where: { deduplicationKey: { startsWith: `trip-cancelled:${trip.id}:` } } }), 3);

    await updateBus({ userId: value.admin.id, role: "ADMIN" }, { id: value.bus.id, status: "MAINTENANCE" });
    assert.equal(await prisma.tripStatusHistory.count({ where: { tripId: trip.id, toStatus: "CANCELLED" } }), 1);
    assert.equal(await prisma.notification.count({ where: { deduplicationKey: { startsWith: `trip-cancelled:${trip.id}:` } } }), 3);
  });

  it("allows only safe empty Trip rescheduling and rejects structural passenger-state edits", async () => {
    const driver = await user("DRIVER", "Assigned Driver");
    const value = await scenario();
    const trip = await schedule(value);
    const rescheduled = new Date(value.departure.getTime() + 60 * 60 * 1_000);
    await updateScheduledTrip(
      { userId: value.admin.id, role: "ADMIN" },
      trip.id,
      { departureTime: rescheduled.toISOString(), driverId: driver.id },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    const shifted = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: { tripStops: { orderBy: { position: "asc" } } } });
    assert.equal(shifted.departureTime.getTime(), rescheduled.getTime());
    assert.equal(shifted.driverId, driver.id);

    const student = await user("STUDENT", "Edit Blocker");
    await prisma.waitlistEntry.create({ data: { studentId: student.id, tripId: trip.id, boardingTripStopId: trip.tripStops[0]!.id, dropOffTripStopId: trip.tripStops[1]!.id } });
    await assert.rejects(
      updateScheduledTrip({ userId: value.admin.id, role: "ADMIN" }, trip.id, { driverId: null }),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
  });

  it("protects terminal Trips, authorization, and historical reads after retirement", async () => {
    const value = await scenario();
    const trip = await schedule(value);
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "ARRIVED" } });
    await assert.rejects(
      cancelTrip({ userId: value.admin.id, role: "ADMIN" }, trip.id, { reason: "Normal future cancellation" }),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
    await assert.rejects(
      createBus({ userId: randomUUID(), role: "STUDENT" }, { plateNumber: "DENIED-1", seatedCapacity: 1, standingCapacity: 0, status: "ACTIVE" }),
      (error: unknown) => error instanceof ApplicationError && error.code === "FORBIDDEN",
    );
    const unassignedDriver = await user("DRIVER", "Unassigned Operator");
    await assert.rejects(
      cancelTrip({ userId: unassignedDriver.id, role: "DRIVER" }, trip.id, { reason: "Unauthorized cancellation" }),
      (error: unknown) => error instanceof ApplicationError && error.code === "FORBIDDEN",
    );
    const driverProjection = await listDrivers({ userId: value.admin.id, role: "ADMIN" });
    assert.equal(Object.hasOwn(driverProjection.find((driver) => driver.id === unassignedDriver.id)!, "passwordHash"), false);
    await assert.rejects(
      createRoute({ userId: randomUUID(), role: "DRIVER" }, { lineId: value.line.id, direction: "INBOUND", name: "Denied", stops: [
        { stopId: value.stops[0]!.id, travelDurationToNextMinutes: 1 },
        { stopId: value.stops[1]!.id, travelDurationToNextMinutes: null },
      ] }),
      (error: unknown) => error instanceof ApplicationError && error.code === "FORBIDDEN",
    );

    await retireRoute({ userId: value.admin.id, role: "ADMIN" }, value.route.id);
    for (const stop of value.stops) await retireStop({ userId: value.admin.id, role: "ADMIN" }, stop.id);
    const historical = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: { tripStops: { orderBy: { position: "asc" } }, route: true, bus: true } });
    assert.equal(historical.tripStops.length, 3);
    assert.equal(historical.route.deletedAt instanceof Date, true);
    assert.deepEqual(historical.tripStops.map((stop) => stop.stopName), trip.tripStops.map((stop) => stop.stopName));
  });
});
