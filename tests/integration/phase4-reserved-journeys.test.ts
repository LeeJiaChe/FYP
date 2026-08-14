import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";

import {
  cancelReservedBooking,
  createReservedBooking,
  findJourneyAvailability,
  joinJourneyWaitlist,
} from "../../src/features/bookings/application/reservations";
import { scheduleTrip } from "../../src/features/trips/application/schedule-trip";
import { ApplicationError } from "../../src/shared/application/application-error";
import { prisma } from "../../src/shared/db/prisma.server";

interface Scenario {
  readonly tripId: string;
  readonly departure: Date;
  readonly stopIds: readonly string[];
  readonly segmentIds: readonly string[];
  readonly seatIds: readonly string[];
}

const created = {
  tripIds: [] as string[],
  routeIds: [] as string[],
  stopIds: [] as string[],
  busIds: [] as string[],
  userIds: [] as string[],
};

function actor(userId: string) {
  return { userId, role: "STUDENT" } as const;
}

function clock(instant: Date) {
  return { now: () => new Date(instant) };
}

async function createStudent(label: string): Promise<string> {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      name: `Phase 4 ${label}`,
      email: `${label.toLowerCase().replaceAll(" ", "-")}-${suffix}@student.tarc.edu.my`,
      studentId: suffix.slice(0, 8).toUpperCase(),
      passwordHash: "integration-only",
      role: "STUDENT",
    },
  });
  created.userIds.push(user.id);
  return user.id;
}

async function createScenario(seatedCapacity: number): Promise<Scenario> {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const stops = await Promise.all(
    [0, 1, 2].map((position) =>
      prisma.stop.create({
        data: {
          code: `P4_${suffix}_${position}`,
          name: `Phase 4 ${suffix} Stop ${position}`,
          latitude: 3.2 + position / 100,
          longitude: 101.7 + position / 100,
        },
      }),
    ),
  );
  created.stopIds.push(...stops.map((stop) => stop.id));
  const route = await prisma.route.create({
    data: {
      name: `Phase 4 Route ${suffix}`,
      routeStops: {
        create: stops.map((stop, position) => ({
          stopId: stop.id,
          position,
          travelDurationToNextMinutes: position === 2 ? null : 10,
        })),
      },
    },
  });
  created.routeIds.push(route.id);
  const bus = await prisma.bus.create({
    data: {
      plateNumber: `P4-${suffix}`,
      seatedCapacity,
      standingCapacity: 0,
      status: "ACTIVE",
    },
  });
  created.busIds.push(bus.id);
  const departure = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const trip = await scheduleTrip(
    { userId: randomUUID(), role: "ADMIN" },
    {
      routeId: route.id,
      busId: bus.id,
      driverId: undefined,
      departureTime: departure.toISOString(),
    },
    clock(new Date(departure.getTime() - 60 * 60 * 1_000)),
  );
  created.tripIds.push(trip.id);
  return {
    tripId: trip.id,
    departure,
    stopIds: trip.tripStops.map((stop) => stop.id),
    segmentIds: trip.tripSegments.map((segment) => segment.id),
    seatIds: trip.tripSeats.map((seat) => seat.id),
  };
}

async function reserve(
  studentId: string,
  scenario: Scenario,
  seatIndex: number,
  boardingIndex: number,
  dropOffIndex: number,
) {
  return createReservedBooking(
    actor(studentId),
    {
      tripId: scenario.tripId,
      tripSeatId: scenario.seatIds[seatIndex]!,
      boardingTripStopId: scenario.stopIds[boardingIndex]!,
      dropOffTripStopId: scenario.stopIds[dropOffIndex]!,
    },
    clock(new Date(scenario.departure.getTime() - 60 * 60 * 1_000)),
  );
}

async function join(
  studentId: string,
  scenario: Scenario,
  boardingIndex: number,
  dropOffIndex: number,
  queuedOffsetMs = -30 * 60 * 1_000,
) {
  return joinJourneyWaitlist(
    actor(studentId),
    {
      tripId: scenario.tripId,
      boardingTripStopId: scenario.stopIds[boardingIndex]!,
      dropOffTripStopId: scenario.stopIds[dropOffIndex]!,
    },
    clock(new Date(scenario.departure.getTime() + queuedOffsetMs)),
  );
}

after(async () => {
  await prisma.deviceStatusLog.deleteMany({
    where: { seat: { tripId: { in: created.tripIds } } },
  });
  await prisma.notification.deleteMany({ where: { userId: { in: created.userIds } } });
  await prisma.penaltyAppeal.deleteMany({ where: { studentId: { in: created.userIds } } });
  await prisma.penalty.deleteMany({ where: { studentId: { in: created.userIds } } });
  await prisma.reservedSeatSegment.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.waitlistEntry.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.booking.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.seat.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripSeat.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripSegment.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.tripStop.deleteMany({ where: { tripId: { in: created.tripIds } } });
  await prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } });
  await prisma.routeStop.deleteMany({ where: { routeId: { in: created.routeIds } } });
  await prisma.route.deleteMany({ where: { id: { in: created.routeIds } } });
  await prisma.stop.deleteMany({ where: { id: { in: created.stopIds } } });
  await prisma.bus.deleteMany({ where: { id: { in: created.busIds } } });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.$disconnect();
});

describe("Phase 4 PostgreSQL reserved journey allocation", () => {
  it("allows adjacent journeys to reuse one TripSeat", async () => {
    const scenario = await createScenario(1);
    const [first, second] = await Promise.all([
      createStudent("Adjacent A B"),
      createStudent("Adjacent B C"),
    ]);
    const bookingAB = await reserve(first, scenario, 0, 0, 1);
    const bookingBC = await reserve(second, scenario, 0, 1, 2);
    assert.equal(bookingAB.tripSeatId, bookingBC.tripSeatId);
    assert.equal(
      await prisma.reservedSeatSegment.count({
        where: { bookingId: { in: [bookingAB.id, bookingBC.id] } },
      }),
      2,
    );
  });

  it("rejects overlapping use of the same TripSeat", async () => {
    const scenario = await createScenario(1);
    const [first, second] = await Promise.all([
      createStudent("Overlap A B"),
      createStudent("Overlap A C"),
    ]);
    await reserve(first, scenario, 0, 0, 1);
    await assert.rejects(
      reserve(second, scenario, 0, 0, 2),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
  });

  it("reports no A-C seat when availability is fragmented", async () => {
    const scenario = await createScenario(2);
    const [first, second, searching] = await Promise.all([
      createStudent("Fragment A B"),
      createStudent("Fragment B C"),
      createStudent("Fragment Search"),
    ]);
    await reserve(first, scenario, 0, 0, 1);
    await reserve(second, scenario, 1, 1, 2);
    const result = await findJourneyAvailability(
      actor(searching),
      {
        tripId: scenario.tripId,
        boardingTripStopId: scenario.stopIds[0]!,
        dropOffTripStopId: scenario.stopIds[2]!,
      },
      clock(new Date(scenario.departure.getTime() - 60 * 60 * 1_000)),
    );
    assert.equal(result.hasAvailableSeat, false);
    assert.deepEqual(result.seats, []);
  });

  it("confirms exactly one concurrent attempt for the final same seat", async () => {
    const scenario = await createScenario(1);
    const [first, second] = await Promise.all([
      createStudent("Concurrent One"),
      createStudent("Concurrent Two"),
    ]);
    const attempts = await Promise.allSettled([
      reserve(first, scenario, 0, 0, 2),
      reserve(second, scenario, 0, 0, 2),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    assert.equal(
      await prisma.booking.count({ where: { tripId: scenario.tripId, status: "CONFIRMED" } }),
      1,
    );
  });

  it("rejects cross-Trip Booking and allocation identities", async () => {
    const [firstTrip, secondTrip] = await Promise.all([
      createScenario(1),
      createScenario(1),
    ]);
    const student = await createStudent("Cross Trip");
    await assert.rejects(
      prisma.booking.create({
        data: {
          studentId: student,
          tripId: firstTrip.tripId,
          tripSeatId: secondTrip.seatIds[0]!,
          boardingTripStopId: firstTrip.stopIds[0]!,
          dropOffTripStopId: firstTrip.stopIds[2]!,
        },
      }),
    );
    const valid = await reserve(student, firstTrip, 0, 0, 1);
    await assert.rejects(
      prisma.reservedSeatSegment.create({
        data: {
          bookingId: valid.id,
          tripId: firstTrip.tripId,
          tripSeatId: firstTrip.seatIds[0]!,
          tripSegmentId: secondTrip.segmentIds[0]!,
        },
      }),
    );
  });

  it("cancellation releases only its claims and preserves an adjacent reservation", async () => {
    const scenario = await createScenario(1);
    const [first, second] = await Promise.all([
      createStudent("Cancel A B"),
      createStudent("Keep B C"),
    ]);
    const cancelled = await reserve(first, scenario, 0, 0, 1);
    const adjacent = await reserve(second, scenario, 0, 1, 2);
    await cancelReservedBooking(
      actor(first),
      cancelled.id,
      clock(new Date(scenario.departure.getTime() - 60 * 60 * 1_000)),
    );
    assert.equal(
      await prisma.reservedSeatSegment.count({ where: { bookingId: cancelled.id } }),
      0,
    );
    assert.equal(
      await prisma.reservedSeatSegment.count({ where: { bookingId: adjacent.id } }),
      1,
    );
    assert.equal(
      (await prisma.booking.findUniqueOrThrow({ where: { id: adjacent.id } })).status,
      "CONFIRMED",
    );
  });

  it("promotes oldest-compatible-first and retains skipped priority", async () => {
    const scenario = await createScenario(2);
    const users = await Promise.all(
      ["Block Seat1 AC", "Seat2 AB", "Seat2 BC", "Oldest AC", "Later AB"].map(
        createStudent,
      ),
    );
    await reserve(users[0]!, scenario, 0, 0, 2);
    const releaseAB = await reserve(users[1]!, scenario, 1, 0, 1);
    const releaseBC = await reserve(users[2]!, scenario, 1, 1, 2);
    const oldest = await join(users[3]!, scenario, 0, 2, -50 * 60 * 1_000);
    const later = await join(users[4]!, scenario, 0, 1, -45 * 60 * 1_000);

    await cancelReservedBooking(
      actor(users[1]!),
      releaseAB.id,
      clock(new Date(scenario.departure.getTime() - 35 * 60 * 1_000)),
    );
    const [oldestAfterSkip, laterAfterPromotion] = await Promise.all([
      prisma.waitlistEntry.findUniqueOrThrow({ where: { id: oldest.id } }),
      prisma.waitlistEntry.findUniqueOrThrow({ where: { id: later.id } }),
    ]);
    assert.equal(oldestAfterSkip.status, "WAITING");
    assert.equal(oldestAfterSkip.queuedAt.getTime(), oldest.queuedAt.getTime());
    assert.equal(laterAfterPromotion.status, "PROMOTED");
    assert.ok(laterAfterPromotion.promotedBookingId);

    await cancelReservedBooking(
      actor(users[2]!),
      releaseBC.id,
      clock(new Date(scenario.departure.getTime() - 34 * 60 * 1_000)),
    );
    await cancelReservedBooking(
      actor(users[4]!),
      laterAfterPromotion.promotedBookingId!,
      clock(new Date(scenario.departure.getTime() - 33 * 60 * 1_000)),
    );
    const promotedOldest = await prisma.waitlistEntry.findUniqueOrThrow({
      where: { id: oldest.id },
      include: { promotedBooking: { include: { reservedSeatSegments: true } } },
    });
    assert.equal(promotedOldest.status, "PROMOTED");
    assert.equal(promotedOldest.promotedBooking?.reservedSeatSegments.length, 2);
    assert.equal(promotedOldest.promotedBooking?.status, "CONFIRMED");
  });

  it("prevents two active Bookings for one student and leaves waitlist unallocated", async () => {
    const scenario = await createScenario(1);
    const [holder, waiter] = await Promise.all([
      createStudent("Active Duplicate"),
      createStudent("No Allocation Waiter"),
    ]);
    await reserve(holder, scenario, 0, 0, 2);
    await assert.rejects(
      reserve(holder, scenario, 0, 0, 1),
      (error) => error instanceof ApplicationError && error.code === "CONFLICT",
    );
    const entry = await join(waiter, scenario, 0, 2);
    assert.equal(
      await prisma.reservedSeatSegment.count({
        where: { booking: { studentId: waiter, tripId: scenario.tripId } },
      }),
      0,
    );
    assert.equal(
      await prisma.booking.count({ where: { studentId: waiter, tripId: scenario.tripId } }),
      0,
    );
    assert.equal(entry.status, "WAITING");
  });

  it("keeps planned allocation unchanged by later operational state", async () => {
    const scenario = await createScenario(1);
    const student = await createStudent("Operational State");
    const booking = await reserve(student, scenario, 0, 0, 2);
    const before = await prisma.reservedSeatSegment.findMany({
      where: { bookingId: booking.id },
      orderBy: { tripSegmentId: "asc" },
    });
    await prisma.$transaction([
      prisma.tripStop.update({
        where: { id: scenario.stopIds[2] },
        data: { actualArrival: new Date(), passedAt: new Date() },
      }),
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: "COMPLETED", checkedInAt: new Date() },
      }),
    ]);
    const after = await prisma.reservedSeatSegment.findMany({
      where: { bookingId: booking.id },
      orderBy: { tripSegmentId: "asc" },
    });
    assert.deepEqual(
      after.map((claim) => [claim.tripSeatId, claim.tripSegmentId]),
      before.map((claim) => [claim.tripSeatId, claim.tripSegmentId]),
    );
  });
});
