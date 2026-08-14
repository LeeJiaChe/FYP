import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/db/prisma.server";

import type {
  CreateRouteInput,
  CreateStopInput,
  UpdateRouteInput,
  UpdateStopInput,
} from "../contracts/fleet.schemas";
import { positionRouteStops } from "../domain/route-topology";

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
  return prisma.stop.update({ where: { id }, data });
}

export async function retireStopRecord(id: string) {
  return prisma.stop.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

const routeInclude = {
  routeStops: {
    orderBy: { position: "asc" },
    include: { stop: true },
  },
  _count: { select: { trips: true } },
} satisfies Prisma.RouteInclude;

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

    return transaction.route.create({
      data: {
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
