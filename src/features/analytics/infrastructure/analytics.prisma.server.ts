import "server-only";

import { Prisma } from "@prisma/client";

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

