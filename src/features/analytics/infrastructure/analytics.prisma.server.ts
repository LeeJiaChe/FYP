import "server-only";

import { Prisma, RouteDirection, TripStatus } from "@prisma/client";

import { prisma } from "@/shared/db/prisma.server";

interface UtilizationRow {
  routeId: string;
  routeName: string;
  totalTrips: bigint;
  seatedCapacitySegments: bigint;
  reservedSeatSegments: bigint;
  standingCapacitySegments: bigint;
  standingSegmentClaims: bigint;
  boardedReserved: bigint;
  boardedWalkIn: bigint;
  demand: bigint;
}

interface NoShowRow {
  routeId: string;
  routeName: string;
  eligibleOutcomes: bigint;
  noShows: bigint;
  completed: bigint;
}

export async function utilizationRows(from: Date, to: Date) {
  return prisma.$queryRaw<UtilizationRow[]>(Prisma.sql`
    SELECT
      r.id AS "routeId",
      r.name AS "routeName",
      COUNT(DISTINCT t.id) AS "totalTrips",
      COALESCE(SUM(t."seatedCapacity" * (SELECT COUNT(*) FROM "TripSegment" ts WHERE ts."tripId" = t.id)), 0) AS "seatedCapacitySegments",
      COALESCE(SUM((SELECT COUNT(*) FROM "ReservedSeatSegment" rss WHERE rss."tripId" = t.id)), 0) AS "reservedSeatSegments",
      COALESCE(SUM(t."standingCapacity" * (SELECT COUNT(*) FROM "TripSegment" ts WHERE ts."tripId" = t.id)), 0) AS "standingCapacitySegments",
      COALESCE(SUM((SELECT COUNT(*) FROM "StandingSegmentClaim" ssc WHERE ssc."tripId" = t.id)), 0) AS "standingSegmentClaims",
      COALESCE(SUM((SELECT COUNT(*) FROM "Booking" b WHERE b."tripId" = t.id AND b."checkedInAt" IS NOT NULL)), 0) AS "boardedReserved",
      COALESCE(SUM((SELECT COUNT(*) FROM "WalkInJourney" wij WHERE wij."tripId" = t.id)), 0) AS "boardedWalkIn",
      COALESCE(SUM(
        (SELECT COUNT(*) FROM "Booking" b WHERE b."tripId" = t.id) +
        (SELECT COUNT(*) FROM "WaitlistEntry" w WHERE w."tripId" = t.id) +
        (SELECT COUNT(*) FROM "WalkInIntent" wi WHERE wi."tripId" = t.id)
      ), 0) AS "demand"
    FROM "Route" r
    LEFT JOIN "Trip" t ON t."routeId" = r.id
      AND t."departureTime" >= ${from}
      AND t."departureTime" < ${to}
      AND t.status <> 'CANCELLED'
    GROUP BY r.id, r.name
    ORDER BY r.name ASC
  `);
}

export async function noShowRows(from: Date, to: Date) {
  return prisma.$queryRaw<NoShowRow[]>(Prisma.sql`
    SELECT
      r.id AS "routeId",
      r.name AS "routeName",
      COUNT(b.id) FILTER (
        WHERE b.status IN ('NO_SHOW', 'COMPLETED')
          OR (b."checkedInAt" IS NOT NULL AND b.status = 'CONFIRMED')
      ) AS "eligibleOutcomes",
      COUNT(b.id) FILTER (WHERE b.status = 'NO_SHOW') AS "noShows",
      COUNT(b.id) FILTER (WHERE b.status = 'COMPLETED') AS "completed"
    FROM "Route" r
    LEFT JOIN "Trip" t ON t."routeId" = r.id
      AND t."departureTime" >= ${from}
      AND t."departureTime" < ${to}
    LEFT JOIN "Booking" b ON b."tripId" = t.id
    GROUP BY r.id, r.name
    ORDER BY r.name ASC
  `);
}

export interface OperationsAnalyticsRawData {
  readonly lines: Array<{
    id: string;
    code: string;
    name: string;
    routes: Array<{
      id: string;
      direction: RouteDirection;
      name: string;
    }>;
  }>;
  readonly buses: Array<{
    id: string;
    plateNumber: string;
    status: string;
  }>;
  readonly trips: Array<{
    id: string;
    routeId: string;
    busId: string;
    driverId: string | null;
    departureTime: Date;
    estimatedArrivalTime: Date;
    boardingDeadline: Date;
    seatedCapacity: number;
    standingCapacity: number;
    status: string;
    delayMinutes: number;
    delayReason: string | null;
    route: {
      id: string;
      lineId: string;
      direction: RouteDirection;
      name: string;
      line: {
        id: string;
        code: string;
        name: string;
      };
    };
    bus: {
      id: string;
      plateNumber: string;
      status: string;
    };
    tripStops: Array<{
      id: string;
      stopId: string;
      position: number;
      stopCode: string;
      stopName: string;
      plannedArrival: Date;
      plannedDeparture: Date;
      actualArrival: Date | null;
      actualDeparture: Date | null;
      passedAt: Date | null;
    }>;
    tripSegments: Array<{
      id: string;
      position: number;
      reservedSeatSegmentsCount: number;
      standingClaimsCount: number;
    }>;
    statusHistory: Array<{
      id: string;
      fromStatus: string;
      toStatus: string;
      reason: string | null;
      occurredAt: Date;
    }>;
    bookings: Array<{
      id: string;
      status: string;
      checkedInAt: Date | null;
      actualAlightedAt: Date | null;
      boardingTripStop: { stopCode: string; stopName: string; position: number };
      dropOffTripStop: { stopCode: string; stopName: string; position: number };
    }>;
    waitlistEntries: Array<{
      id: string;
      status: string;
      promotedBookingId: string | null;
      boardingTripStop: { stopCode: string; stopName: string; position: number };
      dropOffTripStop: { stopCode: string; stopName: string; position: number };
    }>;
    walkInIntents: Array<{
      id: string;
      status: string;
      boardingTripStop: { stopCode: string; stopName: string; position: number };
      dropOffTripStop: { stopCode: string; stopName: string; position: number };
    }>;
    walkInJourneys: Array<{
      id: string;
      status: string;
      boardedAt: Date;
      boardingTripStop: { stopCode: string; stopName: string; position: number };
      dropOffTripStop: { stopCode: string; stopName: string; position: number };
    }>;
    locationSamples: Array<{ recordedAt: Date }>;
    reservedSeatSegmentsCount: number;
  }>;
}

export async function fetchOperationsAnalyticsRawData(
  from: Date,
  to: Date,
  filterLineId?: string,
  filterDirection?: RouteDirection,
  filterStatuses?: readonly TripStatus[],
): Promise<OperationsAnalyticsRawData> {
  const [lines, buses, tripsRaw] = await Promise.all([
    prisma.serviceLine.findMany({
      include: {
        routes: {
          select: {
            id: true,
            direction: true,
            name: true,
          },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.bus.findMany({
      select: {
        id: true,
        plateNumber: true,
        status: true,
      },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.trip.findMany({
      where: {
        departureTime: {
          gte: from,
          lt: to,
        },
        ...(filterLineId
          ? { route: { lineId: filterLineId } }
          : {}),
        ...(filterDirection
          ? { route: { direction: filterDirection } }
          : {}),
        ...(filterStatuses?.length ? { status: { in: [...filterStatuses] } } : {}),
      },
      include: {
        route: {
          include: {
            line: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        bus: {
          select: {
            id: true,
            plateNumber: true,
            status: true,
          },
        },
        tripStops: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            stopId: true,
            position: true,
            stopCode: true,
            stopName: true,
            plannedArrival: true,
            plannedDeparture: true,
            actualArrival: true,
            actualDeparture: true,
            passedAt: true,
          },
        },
        tripSegments: {
          select: {
            id: true,
            position: true,
            _count: {
              select: {
                reservedSeatSegments: true,
                standingClaims: true,
              },
            },
          },
          orderBy: { position: "asc" },
        },
        statusHistory: {
          orderBy: { occurredAt: "asc" },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            reason: true,
            occurredAt: true,
          },
        },
        bookings: {
          select: {
            id: true,
            status: true,
            checkedInAt: true,
            actualAlightedAt: true,
            boardingTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
            dropOffTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
          },
        },
        waitlistEntries: {
          select: {
            id: true,
            status: true,
            promotedBookingId: true,
            boardingTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
            dropOffTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
          },
        },
        walkInIntents: {
          select: {
            id: true,
            status: true,
            boardingTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
            dropOffTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
          },
        },
        walkInJourneys: {
          select: {
            id: true,
            status: true,
            boardedAt: true,
            boardingTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
            dropOffTripStop: {
              select: { stopCode: true, stopName: true, position: true },
            },
          },
        },
        locationSamples: {
          orderBy: { recordedAt: "desc" },
          take: 1,
          select: { recordedAt: true },
        },
      },
      orderBy: { departureTime: "asc" },
    }),
  ]);

  const trips = tripsRaw.map((t) => ({
    id: t.id,
    routeId: t.routeId,
    busId: t.busId,
    driverId: t.driverId,
    departureTime: t.departureTime,
    estimatedArrivalTime: t.estimatedArrivalTime,
    boardingDeadline: t.boardingDeadline,
    seatedCapacity: t.seatedCapacity,
    standingCapacity: t.standingCapacity,
    status: t.status,
    delayMinutes: t.delayMinutes,
    delayReason: t.delayReason,
    route: t.route,
    bus: t.bus,
    tripStops: t.tripStops,
    tripSegments: t.tripSegments.map((segment) => ({
      id: segment.id,
      position: segment.position,
      reservedSeatSegmentsCount: segment._count.reservedSeatSegments,
      standingClaimsCount: segment._count.standingClaims,
    })),
    statusHistory: t.statusHistory,
    bookings: t.bookings,
    waitlistEntries: t.waitlistEntries,
    walkInIntents: t.walkInIntents,
    walkInJourneys: t.walkInJourneys,
    locationSamples: t.locationSamples,
    reservedSeatSegmentsCount: t.tripSegments.reduce(
      (sum, seg) => sum + seg._count.reservedSeatSegments,
      0,
    ),
  }));

  return { lines, buses, trips };
}
