import "server-only";

import { prisma } from "@/shared/db/prisma.server";

export async function findSubscriptionTrip(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, driverId: true, status: true },
  });
}

