import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { buildTripSnapshot } from "../domain/build-trip-snapshot";
import type {
  ListTripsQuery,
  ScheduleTripInput,
  UpdateScheduledTripInput,
} from "../contracts/trip.schemas";
import { canEditSchedule } from "../domain/scheduling-policy";
import { prisma } from "@/shared/db/prisma.server";

export type TripPersistenceFailureCode =
  | "ROUTE_NOT_ACTIVE"
  | "BUS_NOT_ACTIVE"
  | "DRIVER_NOT_VALID"
  | "BUS_SCHEDULE_CONFLICT"
  | "DRIVER_SCHEDULE_CONFLICT"
  | "INVENTORY_COUNT_MISMATCH"
  | "TRIP_NOT_FOUND"
  | "TRIP_NOT_CANCELLABLE"
  | "TRIP_NOT_EDITABLE"
  | "ACTOR_FORBIDDEN";

export class TripPersistenceError extends Error {
  constructor(readonly code: TripPersistenceFailureCode) {
    super(code);
    this.name = "TripPersistenceError";
  }
}

async function lockScheduleKey(
  transaction: Prisma.TransactionClient,
  key: string,
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${key}))
  `;
}

export interface CancelTripTransactionInput {
  readonly tripId: string;
  readonly actorId: string;
  readonly reason: string;
  readonly now: Date;
  readonly allowedStatuses?: readonly ("NOT_STARTED" | "BOARDING" | "DEPARTED")[];
  readonly allowAssignedDriver?: boolean;
}

export async function cancelTripInTransaction(
  transaction: Prisma.TransactionClient,
  input: CancelTripTransactionInput,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Trip" WHERE "id" = ${input.tripId} FOR UPDATE
  `;
  if (rows.length !== 1) throw new TripPersistenceError("TRIP_NOT_FOUND");
  const trip = await transaction.trip.findUniqueOrThrow({
    where: { id: input.tripId },
    include: {
      bookings: {
        where: { status: "CONFIRMED" },
        select: { studentId: true },
      },
      waitlistEntries: {
        where: { status: "WAITING" },
        select: { studentId: true },
      },
      walkInIntents: {
        where: { status: "PENDING" },
        select: { studentId: true },
      },
    },
  });
  const actor = await transaction.user.findUnique({
    where: { id: input.actorId },
    select: { role: true },
  });
  if (
    actor?.role !== "ADMIN" &&
    !(input.allowAssignedDriver && actor?.role === "DRIVER" && trip.driverId === input.actorId)
  ) {
    throw new TripPersistenceError("ACTOR_FORBIDDEN");
  }
  if (trip.status === "CANCELLED") {
    return { trip, alreadyCancelled: true, affectedStudents: 0 };
  }
  if (
    trip.status === "ARRIVED" ||
    (input.allowedStatuses && !input.allowedStatuses.includes(trip.status as "NOT_STARTED" | "BOARDING" | "DEPARTED"))
  ) {
    throw new TripPersistenceError("TRIP_NOT_CANCELLABLE");
  }

  const reason = input.reason.trim();
  if (!reason) throw new TripPersistenceError("TRIP_NOT_CANCELLABLE");
  const studentIds = [
    ...trip.bookings.map((record) => record.studentId),
    ...trip.waitlistEntries.map((record) => record.studentId),
    ...trip.walkInIntents.map((record) => record.studentId),
  ].filter((value, index, values) => values.indexOf(value) === index);

  await transaction.reservedSeatSegment.deleteMany({ where: { tripId: trip.id } });
  await transaction.booking.updateMany({
    where: { tripId: trip.id, status: "CONFIRMED" },
    data: { status: "CANCELLED" },
  });
  await transaction.waitlistEntry.updateMany({
    where: { tripId: trip.id, status: "WAITING" },
    data: { status: "CANCELLED" },
  });
  await transaction.walkInIntent.updateMany({
    where: { tripId: trip.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await transaction.tripStatusHistory.create({
    data: {
      tripId: trip.id,
      fromStatus: trip.status,
      toStatus: "CANCELLED",
      actorId: input.actorId,
      reason,
      occurredAt: input.now,
    },
  });
  const updated = await transaction.trip.update({
    where: { id: trip.id },
    data: { status: "CANCELLED", delayReason: reason },
  });
  if (studentIds.length > 0) {
    await transaction.notification.createMany({
      data: studentIds.map((userId) => ({
        userId,
        type: "CANCELLED" as const,
        message: `Trip cancelled: ${reason}`,
        deduplicationKey: `trip-cancelled:${trip.id}:${userId}`,
      })),
      skipDuplicates: true,
    });
  }
  return { trip: updated, alreadyCancelled: false, affectedStudents: studentIds.length };
}

export async function cancelTripRecord(input: CancelTripTransactionInput) {
  return prisma.$transaction((transaction) => cancelTripInTransaction(transaction, input));
}

export async function updateScheduledTripRecord(
  tripId: string,
  input: UpdateScheduledTripInput,
  now: Date,
) {
  return prisma.$transaction(async (transaction) => {
    await lockScheduleKey(transaction, `trip:${tripId}`);
    const trip = await transaction.trip.findUnique({
      where: { id: tripId },
      include: {
        tripStops: { orderBy: { position: "asc" } },
        _count: {
          select: {
            bookings: true,
            waitlistEntries: true,
            walkInIntents: true,
            walkInJourneys: true,
          },
        },
      },
    });
    if (!trip) throw new TripPersistenceError("TRIP_NOT_FOUND");
    if (!canEditSchedule(trip.status, trip._count)) {
      throw new TripPersistenceError("TRIP_NOT_EDITABLE");
    }

    const departureTime = input.departureTime
      ? new Date(input.departureTime)
      : trip.departureTime;
    if (departureTime <= now) throw new TripPersistenceError("TRIP_NOT_EDITABLE");
    const driverId = input.driverId === undefined ? trip.driverId : input.driverId;
    await lockScheduleKey(transaction, `bus:${trip.busId}`);
    if (driverId) {
      await lockScheduleKey(transaction, `driver:${driverId}`);
      const driver = await transaction.user.findUnique({
        where: { id: driverId },
        select: { role: true },
      });
      if (driver?.role !== "DRIVER") throw new TripPersistenceError("DRIVER_NOT_VALID");
    }
    const durationMs = trip.estimatedArrivalTime.getTime() - trip.departureTime.getTime();
    const estimatedArrivalTime = new Date(departureTime.getTime() + durationMs);
    const overlapWhere = {
      id: { not: trip.id },
      status: { not: "CANCELLED" as const },
      departureTime: { lt: estimatedArrivalTime },
      estimatedArrivalTime: { gt: departureTime },
    };
    if (await transaction.trip.findFirst({ where: { ...overlapWhere, busId: trip.busId }, select: { id: true } })) {
      throw new TripPersistenceError("BUS_SCHEDULE_CONFLICT");
    }
    if (driverId && await transaction.trip.findFirst({ where: { ...overlapWhere, driverId }, select: { id: true } })) {
      throw new TripPersistenceError("DRIVER_SCHEDULE_CONFLICT");
    }

    const shiftMs = departureTime.getTime() - trip.departureTime.getTime();
    for (const stop of trip.tripStops) {
      await transaction.tripStop.update({
        where: { id: stop.id },
        data: {
          plannedArrival: new Date(stop.plannedArrival.getTime() + shiftMs),
          plannedDeparture: new Date(stop.plannedDeparture.getTime() + shiftMs),
          boardingDeadline: new Date(stop.boardingDeadline.getTime() + shiftMs),
        },
      });
    }
    return transaction.trip.update({
      where: { id: trip.id },
      data: {
        departureTime,
        estimatedArrivalTime,
        boardingDeadline: new Date(trip.boardingDeadline.getTime() + shiftMs),
        driverId,
      },
    });
  });
}

export async function createScheduledTripRecord(
  input: ScheduleTripInput,
  boardingCloseGraceMs: number,
) {
  return prisma.$transaction(async (transaction) => {
    await lockScheduleKey(transaction, `route:${input.routeId}`);
    await lockScheduleKey(transaction, `bus:${input.busId}`);
    if (input.driverId) {
      await lockScheduleKey(transaction, `driver:${input.driverId}`);
    }

    const route = await transaction.route.findFirst({
      where: { id: input.routeId, deletedAt: null },
      include: {
        routeStops: {
          orderBy: { position: "asc" },
          include: { stop: true },
        },
      },
    });
    if (!route || route.routeStops.some((routeStop) => routeStop.stop.deletedAt)) {
      throw new TripPersistenceError("ROUTE_NOT_ACTIVE");
    }

    const bus = await transaction.bus.findFirst({
      where: { id: input.busId, deletedAt: null, status: "ACTIVE" },
    });
    if (!bus) throw new TripPersistenceError("BUS_NOT_ACTIVE");

    if (input.driverId) {
      const driver = await transaction.user.findUnique({
        where: { id: input.driverId },
        select: { role: true },
      });
      if (driver?.role !== "DRIVER") {
        throw new TripPersistenceError("DRIVER_NOT_VALID");
      }
    }

    const departureTime = new Date(input.departureTime);
    const snapshot = buildTripSnapshot({
      originDeparture: departureTime,
      boardingCloseGraceMs,
      seatedCapacity: bus.seatedCapacity,
      standingCapacity: bus.standingCapacity,
      routeStops: route.routeStops.map((routeStop) => ({
        stopId: routeStop.stopId,
        position: routeStop.position,
        stopCode: routeStop.stop.code,
        stopName: routeStop.stop.name,
        latitude: routeStop.stop.latitude.toNumber(),
        longitude: routeStop.stop.longitude.toNumber(),
        travelDurationToNextMinutes:
          routeStop.travelDurationToNextMinutes,
      })),
    });

    const overlapWhere = {
      status: { not: "CANCELLED" as const },
      departureTime: { lt: snapshot.estimatedArrivalTime },
      estimatedArrivalTime: { gt: departureTime },
    };
    const busConflict = await transaction.trip.findFirst({
      where: { ...overlapWhere, busId: input.busId },
      select: { id: true },
    });
    if (busConflict) {
      throw new TripPersistenceError("BUS_SCHEDULE_CONFLICT");
    }
    if (input.driverId) {
      const driverConflict = await transaction.trip.findFirst({
        where: { ...overlapWhere, driverId: input.driverId },
        select: { id: true },
      });
      if (driverConflict) {
        throw new TripPersistenceError("DRIVER_SCHEDULE_CONFLICT");
      }
    }

    const trip = await transaction.trip.create({
      data: {
        routeId: input.routeId,
        busId: input.busId,
        driverId: input.driverId ?? null,
        departureTime,
        estimatedArrivalTime: snapshot.estimatedArrivalTime,
        boardingDeadline: snapshot.stops[0]!.boardingDeadline,
        seatedCapacity: snapshot.seatedCapacity,
        standingCapacity: snapshot.standingCapacity,
        status: "NOT_STARTED",
      },
    });

    const tripStops = snapshot.stops.map((stop) => ({
      id: randomUUID(),
      tripId: trip.id,
      stopId: stop.stopId,
      position: stop.position,
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      latitude: stop.latitude,
      longitude: stop.longitude,
      plannedArrival: stop.plannedArrival,
      plannedDeparture: stop.plannedDeparture,
      boardingDeadline: stop.boardingDeadline,
    }));
    const stopInsert = await transaction.tripStop.createMany({ data: tripStops });

    const segmentInsert = await transaction.tripSegment.createMany({
      data: snapshot.segmentPositions.map((position) => ({
        id: randomUUID(),
        tripId: trip.id,
        position,
        fromTripStopId: tripStops[position]!.id,
        toTripStopId: tripStops[position + 1]!.id,
      })),
    });

    const tripSeats = snapshot.seatNumbers.map((seatNumber) => ({
      id: randomUUID(),
      tripId: trip.id,
      seatNumber,
    }));
    const tripSeatInsert = await transaction.tripSeat.createMany({
      data: tripSeats,
    });
    const legacySeatInsert = await transaction.seat.createMany({
      data: tripSeats.map((seat) => ({
        tripId: trip.id,
        tripSeatId: seat.id,
        seatNumber: seat.seatNumber,
        status: "AVAILABLE" as const,
      })),
    });

    if (
      stopInsert.count !== snapshot.stops.length ||
      segmentInsert.count !== snapshot.stops.length - 1 ||
      tripSeatInsert.count !== snapshot.seatedCapacity ||
      legacySeatInsert.count !== snapshot.seatedCapacity
    ) {
      throw new TripPersistenceError("INVENTORY_COUNT_MISMATCH");
    }

    return transaction.trip.findUniqueOrThrow({
      where: { id: trip.id },
      include: {
        route: true,
        bus: true,
        driver: { select: { id: true, name: true, email: true } },
        tripStops: { orderBy: { position: "asc" } },
        tripSegments: { orderBy: { position: "asc" } },
        tripSeats: { orderBy: { seatNumber: "asc" } },
      },
    });
  });
}

export async function listTripRecords(
  query: ListTripsQuery,
  enforcedDriverId?: string,
) {
  const where: Prisma.TripWhereInput = {};
  if (query.routeId) where.routeId = query.routeId;
  if (enforcedDriverId ?? query.driverId) {
    where.driverId = enforcedDriverId ?? query.driverId;
  }
  if (query.date) {
    const start = new Date(`${query.date}T00:00:00.000Z`);
    const end = new Date(`${query.date}T23:59:59.999Z`);
    where.departureTime = { gte: start, lte: end };
  }

  return prisma.trip.findMany({
    where,
    include: {
      route: {
        include: {
          routeStops: {
            orderBy: { position: "asc" },
            include: { stop: true },
          },
        },
      },
      bus: true,
      driver: { select: { id: true, name: true, email: true } },
      tripStops: { orderBy: { position: "asc" } },
      bookings: { select: { status: true, checkedInAt: true } },
      waitlistEntries: { select: { status: true } },
      walkInJourneys: { select: { status: true } },
    },
    orderBy: { departureTime: "asc" },
  });
}

export async function findTripDetailRecord(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      route: { select: { name: true } },
      bus: { select: { plateNumber: true } },
      driver: { select: { id: true, name: true } },
      tripStops: { orderBy: { position: "asc" } },
      tripSeats: {
        orderBy: { seatNumber: "asc" },
        include: {
          bookings: {
            where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
            include: {
              student: { select: { id: true, name: true, studentId: true } },
              boardingTripStop: { select: { stopName: true } },
              dropOffTripStop: { select: { stopName: true } },
            },
          },
        },
      },
      waitlistEntries: {
        where: { status: "WAITING" },
        orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          studentId: true,
          status: true,
          queuedAt: true,
          boardingTripStopId: true,
          dropOffTripStopId: true,
        },
      },
    },
  });
}
