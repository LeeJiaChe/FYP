import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/db/prisma.server";

import type {
  CreateBusInput,
  CreateRouteInput,
  CreateServiceLineInput,
  CreateStopInput,
  UpdateBusInput,
  UpdateRouteInput,
  UpdateServiceLineInput,
  UpdateStopInput,
} from "../contracts/fleet.schemas";
import { assertBusStatusTransition, unavailableBusCancelsFutureTrips } from "../domain/asset-policy";
import { positionRouteStops } from "../domain/route-topology";
import { cancelTripInTransaction } from "@/features/trips/server";

export type FleetPersistenceFailureCode =
  | "NOT_FOUND"
  | "DUPLICATE"
  | "DUPLICATE_ACTIVE_ROUTE"
  | "STOP_IN_ACTIVE_ROUTE"
  | "INVALID_STATUS_TRANSITION";

export class FleetPersistenceError extends Error {
  constructor(readonly code: FleetPersistenceFailureCode) {
    super(code);
    this.name = "FleetPersistenceError";
  }
}

export async function listActiveStopsRecord() {
  return prisma.stop.findMany({
    where: { deletedAt: null },
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });
}

export async function createStopRecord(input: CreateStopInput) {
  return prisma.stop.create({ data: input });
}

export async function updateStopRecord(input: UpdateStopInput) {
  const { id, ...data } = input;
  return prisma.stop.update({ where: { id, deletedAt: null }, data });
}

const busInclude = {
  _count: { select: { trips: true } },
} satisfies Prisma.BusInclude;

export async function listBusesRecord() {
  return prisma.bus.findMany({
    where: { deletedAt: null },
    include: busInclude,
    orderBy: { plateNumber: "asc" },
  });
}

export async function createBusRecord(input: CreateBusInput) {
  return prisma.bus.create({ data: input, include: busInclude });
}

export async function updateBusRecord(
  actorId: string,
  input: UpdateBusInput,
  now: Date,
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`bus:${input.id}`}))
    `;
    const current = await transaction.bus.findFirst({
      where: { id: input.id, deletedAt: null },
    });
    if (!current) throw new FleetPersistenceError("NOT_FOUND");

    const nextStatus = input.status ?? current.status;
    try {
      assertBusStatusTransition(current.status, nextStatus);
    } catch {
      throw new FleetPersistenceError("INVALID_STATUS_TRANSITION");
    }

    const updated = await transaction.bus.update({
      where: { id: current.id },
      data: {
        ...(input.plateNumber === undefined ? {} : { plateNumber: input.plateNumber }),
        ...(input.seatedCapacity === undefined ? {} : { seatedCapacity: input.seatedCapacity }),
        ...(input.standingCapacity === undefined ? {} : { standingCapacity: input.standingCapacity }),
        ...(input.status === undefined ? {} : { status: input.status }),
      },
      include: busInclude,
    });

    if (unavailableBusCancelsFutureTrips(current.status, nextStatus)) {
      const affected = await transaction.trip.findMany({
        where: { busId: current.id, status: "NOT_STARTED" },
        orderBy: { departureTime: "asc" },
        select: { id: true },
      });
      const reason = `Bus ${updated.plateNumber} placed in ${nextStatus}`;
      for (const trip of affected) {
        await cancelTripInTransaction(transaction, {
          tripId: trip.id,
          actorId,
          reason,
          now,
          allowedStatuses: ["NOT_STARTED"],
        });
      }
    }
    return updated;
  });
}

export async function retireBusRecord(actorId: string, id: string, now: Date) {
  await updateBusRecord(actorId, { id, status: "RETIRED" }, now);
  return prisma.bus.update({
    where: { id },
    data: { deletedAt: now },
    include: busInclude,
  });
}

export async function retireStopRecord(id: string) {
  return prisma.$transaction(async (transaction) => {
    const activeReference = await transaction.routeStop.findFirst({
      where: { stopId: id, route: { deletedAt: null } },
      select: { id: true },
    });
    if (activeReference) throw new FleetPersistenceError("STOP_IN_ACTIVE_ROUTE");
    return transaction.stop.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  });
}

const routeInclude = {
  line: true,
  routeStops: {
    orderBy: { position: "asc" },
    include: { stop: true },
  },
  _count: { select: { trips: true } },
} satisfies Prisma.RouteInclude;

export async function listServiceLinesRecord() {
  return prisma.serviceLine.findMany({
    include: { _count: { select: { routes: true } } },
    orderBy: { code: "asc" },
  });
}

export async function createServiceLineRecord(input: CreateServiceLineInput) {
  return prisma.serviceLine.create({
    data: input,
    include: { _count: { select: { routes: true } } },
  });
}

export async function updateServiceLineRecord(input: UpdateServiceLineInput) {
  const { id, ...data } = input;
  return prisma.serviceLine.update({
    where: { id },
    data,
    include: { _count: { select: { routes: true } } },
  });
}

export async function listActiveRoutesRecord() {
  return prisma.route.findMany({
    where: {
      deletedAt: null,
      routeStops: { none: { stop: { deletedAt: { not: null } } } },
    },
    include: routeInclude,
    orderBy: { name: "asc" },
  });
}

export async function createRouteRecord(input: CreateRouteInput) {
  const stops = positionRouteStops(input.stops);
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`route-slot:${input.lineId}:${input.direction}`}))
    `;
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`route-name:${input.name}`}))
    `;

    const activeStopCount = await transaction.stop.count({
      where: {
        id: { in: stops.map((stop) => stop.stopId) },
        deletedAt: null,
      },
    });
    if (activeStopCount !== stops.length) {
      throw new Error("ROUTE_CONTAINS_INACTIVE_STOP");
    }
    const line = await transaction.serviceLine.findUnique({
      where: { id: input.lineId },
      select: { id: true },
    });
    if (!line) throw new FleetPersistenceError("NOT_FOUND");

    const existingActive = await transaction.route.findFirst({
      where: {
        lineId: input.lineId,
        direction: input.direction,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existingActive) throw new FleetPersistenceError("DUPLICATE_ACTIVE_ROUTE");

    return transaction.route.create({
      data: {
        lineId: input.lineId,
        direction: input.direction,
        name: input.name,
        routeStops: {
          create: stops.map((stop) => ({
            stopId: stop.stopId,
            position: stop.position,
            travelDurationToNextMinutes:
              stop.travelDurationToNextMinutes,
          })),
        },
      },
      include: routeInclude,
    });
  });
}

export async function updateRouteRecord(input: UpdateRouteInput) {
  const positionedStops = input.stops
    ? positionRouteStops(input.stops)
    : undefined;

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`route:${input.id}`}))
    `;

    const current = await transaction.route.findFirst({
      where: { id: input.id, deletedAt: null },
      select: { id: true, lineId: true, direction: true },
    });
    if (!current) throw new FleetPersistenceError("NOT_FOUND");

    const targetLineId = input.lineId ?? current.lineId;
    const targetDirection = input.direction ?? current.direction;
    if (targetLineId !== current.lineId || targetDirection !== current.direction) {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`route-slot:${targetLineId}:${targetDirection}`}))
      `;
      const targetLine = await transaction.serviceLine.findUnique({
        where: { id: targetLineId },
        select: { id: true },
      });
      if (!targetLine) throw new FleetPersistenceError("NOT_FOUND");

      const existingActive = await transaction.route.findFirst({
        where: {
          lineId: targetLineId,
          direction: targetDirection,
          deletedAt: null,
          id: { not: input.id },
        },
        select: { id: true },
      });
      if (existingActive) throw new FleetPersistenceError("DUPLICATE_ACTIVE_ROUTE");
    }

    if (positionedStops) {
      const activeStopCount = await transaction.stop.count({
        where: {
          id: { in: positionedStops.map((stop) => stop.stopId) },
          deletedAt: null,
        },
      });
      if (activeStopCount !== positionedStops.length) {
        throw new Error("ROUTE_CONTAINS_INACTIVE_STOP");
      }
      await transaction.routeStop.deleteMany({
        where: { routeId: input.id },
      });
    }

    return transaction.route.update({
      where: { id: input.id, deletedAt: null },
      data: {
        ...(input.lineId === undefined ? {} : { lineId: input.lineId }),
        ...(input.direction === undefined ? {} : { direction: input.direction }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(positionedStops === undefined
          ? {}
          : {
              routeStops: {
                create: positionedStops.map((stop) => ({
                  stopId: stop.stopId,
                  position: stop.position,
                  travelDurationToNextMinutes:
                    stop.travelDurationToNextMinutes,
                })),
              },
            }),
      },
      include: routeInclude,
    });
  });
}

export async function retireRouteRecord(id: string) {
  return prisma.route.update({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
