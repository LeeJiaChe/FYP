import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
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
  confirmBulkSchedule,
  scheduleTrip,
  updateScheduledTrip,
} from "../../src/features/trips/application/schedule-trip";
import { toServiceDateKey } from "../../src/features/trips/domain/scheduling-policy";
import { mytLocalDateTimeToIso } from "../../src/shared/time/operational-time";
import { ApplicationError } from "../../src/shared/application/application-error";
import { cancelJourneyWaitlistEntry, cancelReservedBooking, createReservedBooking, joinJourneyWaitlist } from "../../src/features/bookings/application/reservations";
import { createWalkInIntent } from "../../src/features/walk-ins/application/walk-ins";
import { progressTrip } from "../../src/features/boarding/application/boarding";
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
  const serviceDay = toServiceDateKey(new Date(Date.now() + 24 * 60 * 60 * 1_000));
  const departure = new Date(mytLocalDateTimeToIso(`${serviceDay}T08:00`));
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

async function waitForBlockedQuery(blocker: number, event: string) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const [row] = await prisma.$queryRaw<Array<{ pid: number }>>`
      SELECT pid FROM pg_stat_activity
      WHERE wait_event = ${event} AND ${blocker}::integer = ANY(pg_blocking_pids(pid)) LIMIT 1
    `;
    if (row) return row.pid;
    await delay(10);
  }
  assert.fail(`Expected a PostgreSQL lock waiter on ${event}`);
}

async function withScheduleBarrier(key: string, work: (pid: number) => Promise<void>) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const [row] = await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    await work(row!.pid);
  }, { timeout: 8_000 });
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
        serviceDate: toServiceDateKey(value.departure),
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

    const cancelScenario = await scenario();
    const assignedDriver = await user("DRIVER", "Assigned Driver For Cancel");
    const assignedTrip = await schedule(cancelScenario, { driverId: assignedDriver.id });
    await assert.rejects(
      cancelTrip({ userId: assignedDriver.id, role: "DRIVER" }, assignedTrip.id, { reason: "Driver attempting cancel" }),
      (error: unknown) => error instanceof ApplicationError && error.code === "FORBIDDEN",
    );
  });

  it("enforces Route active-slot uniqueness with soft deletion coexistence", async () => {
    const admin = await user("ADMIN", "Route Uniqueness Admin");
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const lineA = await prisma.serviceLine.create({
      data: { code: `LINEA_${suffix}`, name: `Line A ${suffix}` },
    });
    const lineB = await prisma.serviceLine.create({
      data: { code: `LINEB_${suffix}`, name: `Line B ${suffix}` },
    });
    created.lineIds.push(lineA.id, lineB.id);

    const [stopA, stopB] = await Promise.all([
      createStop({ userId: admin.id, role: "ADMIN" }, { code: `STOPA_${suffix}`, name: "Stop A", latitude: 3.2, longitude: 101.7 }),
      createStop({ userId: admin.id, role: "ADMIN" }, { code: `STOPB_${suffix}`, name: "Stop B", latitude: 3.21, longitude: 101.71 }),
    ]);
    created.stopIds.push(stopA.id, stopB.id);

    const simpleStops = [
      { stopId: stopA.id, travelDurationToNextMinutes: 5 },
      { stopId: stopB.id, travelDurationToNextMinutes: null },
    ];

    // A. One active LineA OUTBOUND exists -> creating another active one is rejected.
    const routeA1 = await createRoute(
      { userId: admin.id, role: "ADMIN" },
      { lineId: lineA.id, direction: "OUTBOUND", name: `Line A Outbound 1 ${suffix}`, stops: simpleStops },
    );
    created.routeIds.push(routeA1.id);

    await assert.rejects(
      createRoute(
        { userId: admin.id, role: "ADMIN" },
        { lineId: lineA.id, direction: "OUTBOUND", name: `Line A Outbound 2 ${suffix}`, stops: simpleStops },
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT",
    );

    // C. INBOUND and OUTBOUND for same Line may coexist.
    const routeAInbound = await createRoute(
      { userId: admin.id, role: "ADMIN" },
      { lineId: lineA.id, direction: "INBOUND", name: `Line A Inbound ${suffix}`, stops: simpleStops },
    );
    created.routeIds.push(routeAInbound.id);
    assert.equal(routeAInbound.direction, "INBOUND");

    // D. Different Lines may each have OUTBOUND.
    const routeBOutbound = await createRoute(
      { userId: admin.id, role: "ADMIN" },
      { lineId: lineB.id, direction: "OUTBOUND", name: `Line B Outbound ${suffix}`, stops: simpleStops },
    );
    created.routeIds.push(routeBOutbound.id);
    assert.equal(routeBOutbound.direction, "OUTBOUND");

    // B. Deactivate existing LineA OUTBOUND -> replacement LineA OUTBOUND can be created.
    await retireRoute({ userId: admin.id, role: "ADMIN" }, routeA1.id);
    const routeA2 = await createRoute(
      { userId: admin.id, role: "ADMIN" },
      { lineId: lineA.id, direction: "OUTBOUND", name: `Line A Replacement Outbound ${suffix}`, stops: simpleStops },
    );
    created.routeIds.push(routeA2.id);
    assert.equal(routeA2.direction, "OUTBOUND");

    // E. Updating a Route into another active Line+Direction slot is rejected.
    await assert.rejects(
      updateRoute(
        { userId: admin.id, role: "ADMIN" },
        { id: routeAInbound.id, direction: "OUTBOUND" },
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
  });

  it("enforces ServiceBlock date integrity on scheduling and rescheduling", async () => {
    const value = await scenario();
    const nextDayDeparture = new Date(value.departure.getTime() + 24 * 60 * 60 * 1_000);
    const block = await createServiceBlock(
      { userId: value.admin.id, role: "ADMIN" },
      {
        code: `BLOCK-DATE-${randomUUID().slice(0, 6).toUpperCase()}`,
        serviceDate: toServiceDateKey(value.departure),
        busId: value.bus.id,
      },
    );
    created.blockIds.push(block.id);

    // Reject mismatch on trip creation
    await assert.rejects(
      scheduleTrip(
        { userId: value.admin.id, role: "ADMIN" },
        {
          routeId: value.route.id,
          busId: value.bus.id,
          blockId: block.id,
          departureTime: nextDayDeparture.toISOString(),
        },
        fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT" && error.message.includes("ServiceBlock service date"),
    );

    // Schedule on correct date
    const trip = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: value.route.id,
        busId: value.bus.id,
        blockId: block.id,
        departureTime: value.departure.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(trip.id);

    // Rescheduling to a different date must be rejected
    await assert.rejects(
      updateScheduledTrip(
        { userId: value.admin.id, role: "ADMIN" },
        trip.id,
        { departureTime: nextDayDeparture.toISOString() },
        fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
      ),
      (error: unknown) => error instanceof ApplicationError && error.code === "CONFLICT" && error.message.includes("ServiceBlock service date"),
    );
  });

  it("maintains ServiceBlock chronological order and resequences automatically", async () => {
    const value = await scenario();
    const block = await createServiceBlock(
      { userId: value.admin.id, role: "ADMIN" },
      {
        code: `BLOCK-SEQ-${randomUUID().slice(0, 6).toUpperCase()}`,
        serviceDate: toServiceDateKey(value.departure),
        busId: value.bus.id,
      },
    );
    created.blockIds.push(block.id);

    // Create 10:00 first, then 08:00 (departure is 08:00 base, time10 is +2 hours)
    const time08 = new Date(value.departure.getTime());
    const time10 = new Date(value.departure.getTime() + 2 * 60 * 60 * 1_000);

    const trip10 = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: value.route.id,
        busId: value.bus.id,
        blockId: block.id,
        departureTime: time10.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(trip10.id);

    const trip08 = await scheduleTrip(
      { userId: value.admin.id, role: "ADMIN" },
      {
        routeId: value.route.id,
        busId: value.bus.id,
        blockId: block.id,
        departureTime: time08.toISOString(),
      },
      fixed(new Date(value.departure.getTime() - 60 * 60 * 1_000)),
    );
    created.tripIds.push(trip08.id);

    // Verify final order: 08:00 is Seq 1, 10:00 is Seq 2
    const fetched08 = await prisma.trip.findUniqueOrThrow({ where: { id: trip08.id } });
    const fetched10 = await prisma.trip.findUniqueOrThrow({ where: { id: trip10.id } });
    assert.equal(fetched08.blockSequence, 1);
    assert.equal(fetched10.blockSequence, 2);

    // Reschedule Seq 2 (10:00) earlier than Seq 1 (08:00) -> e.g. 07:00 (1 hour before 08:00)
    const time07 = new Date(value.departure.getTime() - 60 * 60 * 1_000);
    await updateScheduledTrip(
      { userId: value.admin.id, role: "ADMIN" },
      trip10.id,
      { departureTime: time07.toISOString() },
      fixed(new Date(time07.getTime() - 60 * 60 * 1_000)),
    );

    // Now trip10 (at 07:00) should be Seq 1, and trip08 (at 08:00) should be Seq 2
    const reseq10 = await prisma.trip.findUniqueOrThrow({ where: { id: trip10.id } });
    const reseq08 = await prisma.trip.findUniqueOrThrow({ where: { id: trip08.id } });
    assert.equal(reseq10.blockSequence, 1);
    assert.equal(reseq08.blockSequence, 2);
  });
});

describe("schedule and passenger concurrency on PostgreSQL", () => {
  for (const mutation of ["reservation", "walk-in", "driver progress"] as const) {
    it(`rechecks the Trip after the Bus lock when ${mutation} commits first`, { timeout: 10_000 }, async () => {
      const student = await user("STUDENT", "Race Passenger");
      const driver = await user("DRIVER", "Race Driver");
      const value = await scenario({ driverId: driver.id });
      const scheduled = await schedule(value);
      const inventory = await prisma.trip.findUniqueOrThrow({ where: { id: scheduled.id }, include: {
        tripStops: { orderBy: { position: "asc" } }, tripSeats: true,
      } });
      const journey = { tripId: scheduled.id, boardingTripStopId: inventory.tripStops[0]!.id,
        dropOffTripStopId: inventory.tripStops.at(-1)!.id };
      const clock = fixed(new Date(value.departure.getTime() - 60_000));
      const actor = { userId: value.admin.id, role: "ADMIN" } as const;
      let edit: PromiseSettledResult<unknown> | undefined;
      let editing: Promise<void> | undefined;
      await withScheduleBarrier(`bus:${value.bus.id}`, async (pid) => {
        editing = updateScheduledTrip(actor, scheduled.id, {
          departureTime: new Date(value.departure.getTime() + 30 * 60_000).toISOString(),
        }, clock).then(
          (result) => { edit = { status: "fulfilled", value: result }; },
          (reason: unknown) => { edit = { status: "rejected", reason }; },
        );
        await waitForBlockedQuery(pid, "advisory");
        const passenger = { userId: student.id, role: "STUDENT" } as const;
        if (mutation === "reservation") {
          await createReservedBooking(passenger, { ...journey, tripSeatId: inventory.tripSeats[0]!.id }, clock);
        } else if (mutation === "walk-in") {
          await createWalkInIntent(passenger, journey, clock);
        } else {
          await progressTrip({ userId: driver.id, role: "DRIVER" }, scheduled.id, { action: "START_BOARDING" }, clock);
        }
      });
      await editing;
      assert.ok(edit?.status === "rejected" && edit.reason instanceof ApplicationError && edit.reason.code === "CONFLICT",
        `An edit must reject after committed ${mutation}`);
      const afterEdit = await prisma.trip.findUniqueOrThrow({ where: { id: scheduled.id } });
      assert.equal(afterEdit.departureTime.toISOString(), value.departure.toISOString());
    });
  }
});

it("a reservation waiting behind an edit validates the replacement departure", { timeout: 10_000 }, async () => {
  const student = await user("STUDENT", "Edit Winner Passenger");
  const value = await scenario();
  const trip = await schedule(value);
  const inventory = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: {
    tripStops: { orderBy: { position: "asc" } }, tripSeats: true,
  } });
  const actor = { userId: value.admin.id, role: "ADMIN" } as const;
  const clock = fixed(new Date(value.departure.getTime() - 60_000));
  const shifted = new Date(value.departure.getTime() + 8 * 86_400_000).toISOString();
  let editing: Promise<unknown> | undefined;
  let booking: Promise<unknown> | undefined;
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "TripStop" WHERE id = ${inventory.tripStops[0]!.id}::uuid FOR UPDATE`;
    const [blocker] = await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    editing = updateScheduledTrip(actor, trip.id, { departureTime: shifted }, clock);
    const editorPid = await waitForBlockedQuery(blocker!.pid, "transactionid");
    booking = assert.rejects(createReservedBooking({ userId: student.id, role: "STUDENT" }, {
      tripId: trip.id, tripSeatId: inventory.tripSeats[0]!.id,
      boardingTripStopId: inventory.tripStops[0]!.id, dropOffTripStopId: inventory.tripStops.at(-1)!.id,
    }, clock), (error: unknown) => error instanceof ApplicationError && /opened yet/i.test(error.message));
    await waitForBlockedQuery(editorPid, "transactionid");
  }, { timeout: 8_000 });
  await editing;
  await booking;
  assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).departureTime.toISOString(), shifted);
  assert.equal(await prisma.booking.count({ where: { tripId: trip.id } }), 0);
});

for (const kind of ["single", "bulk"] as const) {
  it(`serializes schedule edit and ${kind} creation in one ServiceBlock`, { timeout: 10_000 }, async () => {
    const driver = await user("DRIVER", "Block Race Driver");
    const value = await scenario({ driverId: driver.id });
    const actor = { userId: value.admin.id, role: "ADMIN" } as const;
    const dateKey = toServiceDateKey(value.departure);
    const clock = fixed(new Date(value.departure.getTime() - 60_000));
    const block = await createServiceBlock(actor, {
      code: `RACE-${randomUUID().slice(0, 8)}`, serviceDate: dateKey, busId: value.bus.id,
    });
    created.blockIds.push(block.id);
    const first = await scheduleTrip(actor, {
      routeId: value.route.id, busId: value.bus.id, blockId: block.id, driverId: driver.id,
      departureTime: value.departure.toISOString(),
    }, clock);
    created.tripIds.push(first.id);
    let operations: Promise<PromiseSettledResult<unknown>[]> | undefined;
    await withScheduleBarrier(`block:${block.id}`, async (holder) => {
      const edit = updateScheduledTrip(actor, first.id, {
        departureTime: mytLocalDateTimeToIso(`${dateKey}T08:30`),
      }, clock);
      const editPid = await waitForBlockedQuery(holder, "advisory");
      const create = kind === "single" ? scheduleTrip(actor, {
        routeId: value.route.id, busId: value.bus.id, blockId: block.id, driverId: driver.id,
        departureTime: mytLocalDateTimeToIso(`${dateKey}T10:00`),
      }, clock).then(({ id }) => { created.tripIds.push(id); }) : confirmBulkSchedule(actor, {
        routeId: value.route.id, blockId: block.id, busIds: [value.bus.id], driverIds: [driver.id],
        serviceDateFrom: dateKey, serviceDateTo: dateKey, weekdays: [], startTime: "10:00",
        endTime: "10:30", headwayMinutes: 30,
      }, clock).then(({ tripIds }) => { created.tripIds.push(...tripIds); });
      operations = Promise.allSettled([edit, create]);
      await waitForBlockedQuery(editPid, "advisory");
    });
    const outcomes = await operations;
    assert.deepEqual(outcomes?.map(({ status }) => status), ["fulfilled", "fulfilled"]);
    const trips = await prisma.trip.findMany({ where: { blockId: block.id }, orderBy: { departureTime: "asc" } });
    assert.equal(trips.length, kind === "single" ? 2 : 3);
    assert.deepEqual(trips.map(({ blockSequence }) => blockSequence), trips.map((_, index) => index + 1));
  });
}

it("waitlist cancellation ahead of released capacity cannot be overwritten by promotion", { timeout: 10_000 }, async () => {
  const value = await scenario();
  const trip = await schedule(value);
  const inventory = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, include: {
    tripStops: { orderBy: { position: "asc" } }, tripSeats: true,
  } });
  const [first, second, waiting] = await Promise.all([
    user("STUDENT", "Waitlist Booked One"), user("STUDENT", "Waitlist Booked Two"), user("STUDENT", "Waitlist Cancels"),
  ]);
  const actor = (userId: string) => ({ userId, role: "STUDENT" } as const);
  const clock = fixed(new Date(value.departure.getTime() - 60_000));
  const journey = { tripId: trip.id, boardingTripStopId: inventory.tripStops[0]!.id,
    dropOffTripStopId: inventory.tripStops.at(-1)!.id };
  const booking = await createReservedBooking(actor(first.id), { ...journey, tripSeatId: inventory.tripSeats[0]!.id }, clock);
  await createReservedBooking(actor(second.id), { ...journey, tripSeatId: inventory.tripSeats[1]!.id }, clock);
  const entry = await joinJourneyWaitlist(actor(waiting.id), journey, clock);
  let results: Promise<unknown> | undefined;
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM "Trip" WHERE id = ${trip.id} FOR UPDATE`;
    const [holder] = await transaction.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    const cancelEntry = cancelJourneyWaitlistEntry(actor(waiting.id), entry.id);
    const canceller = await waitForBlockedQuery(holder!.pid, "transactionid");
    const cancelBooking = cancelReservedBooking(actor(first.id), booking.id, clock);
    results = Promise.all([cancelEntry, cancelBooking]);
    await waitForBlockedQuery(canceller, "tuple");
  }, { timeout: 8_000 });
  await results;
  const stored = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entry.id } });
  assert.equal(stored.status, "CANCELLED");
  assert.equal(stored.promotedBookingId, null);
});
