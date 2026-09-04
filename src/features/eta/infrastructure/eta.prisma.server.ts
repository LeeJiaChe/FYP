import "server-only";

import { prisma } from "@/shared/db/prisma.server";

export async function findTripForEta(tripId: string) {
  return prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      delayMinutes: true,
      departureTime: true,
      estimatedArrivalTime: true,
      driverId: true,
      tripStops: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          stopId: true,
          position: true,
          stopCode: true,
          stopName: true,
          latitude: true,
          longitude: true,
          plannedArrival: true,
          plannedDeparture: true,
          actualArrival: true,
          actualDeparture: true,
          passedAt: true,
        },
      },
    },
  });
}

export async function findBookingForEta(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      studentId: true,
      tripId: true,
      status: true,
      checkedInAt: true,
      actualAlightedAt: true,
      boardingTripStopId: true,
      dropOffTripStopId: true,
      boardingTripStop: {
        select: {
          id: true,
          stopCode: true,
          stopName: true,
          position: true,
          plannedArrival: true,
          actualArrival: true,
          actualDeparture: true,
          passedAt: true,
        },
      },
      dropOffTripStop: {
        select: {
          id: true,
          stopCode: true,
          stopName: true,
          position: true,
          plannedArrival: true,
          actualArrival: true,
          actualDeparture: true,
          passedAt: true,
        },
      },
      trip: {
        select: {
          id: true,
          status: true,
          delayMinutes: true,
          driverId: true,
        },
      },
    },
  });
}
