import "server-only";

import { randomUUID } from "node:crypto";

import { prisma } from "@/shared/db/prisma.server";

export async function findTelemetryTrip(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, status: true },
  });
}

export async function createLocationSample(input: {
  tripId: string;
  latitude: number;
  longitude: number;
  recordedAt: Date;
  source: "SIMULATED" | "GPS";
}) {
  return prisma.tripLocationSample.create({
    data: { id: randomUUID(), ...input },
  });
}

export async function findLatestLocationSample(tripId: string) {
  return prisma.tripLocationSample.findFirst({
    where: { tripId },
    orderBy: [{ recordedAt: "desc" }, { receivedAt: "desc" }],
  });
}

export async function deleteLocationSamplesBefore(cutoff: Date) {
  return prisma.tripLocationSample.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });
}

export async function findSimulatorTrip(preferredTripId?: string) {
  return prisma.trip.findFirst({
    where: {
      ...(preferredTripId ? { id: preferredTripId } : {}),
      status: { in: ["BOARDING", "DEPARTED"] },
    },
    orderBy: { departureTime: "asc" },
    include: { tripStops: { orderBy: { position: "asc" } } },
  });
}

