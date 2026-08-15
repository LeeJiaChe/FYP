import type { AnalyticsRange } from "../contracts/analytics.schemas";
import { noShowPercent, utilizationPercent } from "../domain/metrics";
import { noShowRows, utilizationRows } from "../infrastructure/analytics.prisma.server";
import { forbidden, validationError } from "@/shared/application/application-error";
import { systemClock, type Clock } from "@/shared/time/clock";

export interface AnalyticsActor { readonly role: string }

function boundedRange(range: AnalyticsRange, clock: Clock) {
  const to = range.to ?? clock.now();
  const from = range.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1_000);
  if (from >= to) throw validationError("Analytics from must be before to");
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1_000) {
    throw validationError("Analytics range cannot exceed 366 days");
  }
  return { from, to };
}

export async function routeUtilization(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  const dates = boundedRange(range, clock);
  const rows = await utilizationRows(dates.from, dates.to);
  return rows.map((row) => {
    const seatedCapacitySegments = Number(row.seatedCapacitySegments);
    const reservedSeatSegments = Number(row.reservedSeatSegments);
    const standingCapacitySegments = Number(row.standingCapacitySegments);
    const standingSegmentClaims = Number(row.standingSegmentClaims);
    const fullRouteName = row.routeName;
    return {
      routeId: row.routeId,
      routeName: fullRouteName.split(":")[1]?.trim() || fullRouteName,
      fullRouteName,
      totalTrips: Number(row.totalTrips),
      seatedCapacitySegments,
      reservedSeatSegments,
      seatedUtilizationRate: utilizationPercent(reservedSeatSegments, seatedCapacitySegments),
      utilizationRate: utilizationPercent(reservedSeatSegments, seatedCapacitySegments),
      standingCapacitySegments,
      standingSegmentClaims,
      standingUtilizationRate: utilizationPercent(standingSegmentClaims, standingCapacitySegments),
      ridership: Number(row.boardedReserved) + Number(row.boardedWalkIn),
      demand: Number(row.demand),
    };
  });
}

export async function routeNoShowRates(
  actor: AnalyticsActor,
  range: AnalyticsRange,
  clock: Clock = systemClock,
) {
  if (actor.role !== "ADMIN") throw forbidden("Admin role required");
  const dates = boundedRange(range, clock);
  const rows = await noShowRows(dates.from, dates.to);
  return rows.map((row) => ({
    routeId: row.routeId,
    routeName: row.routeName.split(":")[1]?.trim() || row.routeName,
    fullRouteName: row.routeName,
    totalBookings: Number(row.eligibleOutcomes),
    totalNoShows: Number(row.noShows),
    totalCompleted: Number(row.completed),
    noShowRate: noShowPercent(Number(row.noShows), Number(row.eligibleOutcomes)),
  }));
}

