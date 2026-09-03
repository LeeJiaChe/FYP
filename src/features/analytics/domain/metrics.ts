export const ON_TIME_TOLERANCE_MINUTES = 5;
export const MYT_TIMEZONE = "Asia/Kuala_Lumpur";

export type InsightSeverity = "info" | "warning" | "danger" | "success";
export type InsightType =
  | "CAPACITY_PRESSURE"
  | "RELIABILITY"
  | "NO_SHOW"
  | "FLEET_UTILIZATION"
  | "INSUFFICIENT_DATA";

export interface OperationalInsight {
  readonly type: InsightType;
  readonly severity: InsightSeverity;
  readonly title: string;
  readonly message: string;
  readonly evidence: string;
  readonly sampleSize: number;
}

export function percentageOrNull(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator <= 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  return Math.round((numerator / denominator) * 100);
}

export function averageOrNull(
  sum: number,
  count: number,
): number | null {
  if (count <= 0 || !Number.isFinite(sum) || !Number.isFinite(count)) {
    return null;
  }
  return Math.round((sum / count) * 10) / 10;
}

export function utilizationPercent(usedSegments: number, capacitySegments: number): number {
  if (capacitySegments <= 0) return 0;
  return Math.round((usedSegments / capacitySegments) * 100);
}

export function noShowPercent(noShows: number, eligibleOutcomes: number): number {
  if (eligibleOutcomes <= 0) return 0;
  return Math.round((noShows / eligibleOutcomes) * 100);
}

export function calculateFinalizedWaitlistPromotionRate(
  promoted: number,
  expired: number,
): number | null {
  const finalized = promoted + expired;
  return percentageOrNull(promoted, finalized);
}

export function isDepartureOnTime(
  planned: Date,
  actual: Date,
  toleranceMinutes = ON_TIME_TOLERANCE_MINUTES,
): boolean {
  const toleranceMs = toleranceMinutes * 60 * 1_000;
  return actual.getTime() <= planned.getTime() + toleranceMs;
}

export function departureDelayMinutes(planned: Date, actual: Date): number {
  const diffMs = actual.getTime() - planned.getTime();
  if (diffMs <= 0) return 0;
  return Math.round(diffMs / 60_000);
}

export function isAdministrativeCleanupReason(reason?: string | null): boolean {
  if (!reason) return false;
  const normalized = reason.trim().toLowerCase();
  return (
    normalized.startsWith("stale prototype") ||
    normalized.includes("cleanup after transit model") ||
    normalized.includes("shared development migration") ||
    normalized.includes("prototype data cleanup")
  );
}

export function isAdministrativeCleanupTrip(trip: {
  status: string;
  statusHistory?: Array<{ toStatus: string; reason?: string | null }>;
  delayReason?: string | null;
}): boolean {
  if (trip.status !== "CANCELLED") return false;
  const cancelReason =
    trip.statusHistory?.filter((h) => h.toStatus === "CANCELLED").pop()?.reason ??
    trip.delayReason;
  return isAdministrativeCleanupReason(cancelReason);
}

export function isAnalyticsOperatedTrip(
  trip: {
    status: string;
    tripStops?: Array<{ position?: number; actualDeparture?: Date | null }>;
  },
  isAdminCleanup: boolean,
): boolean {
  if (isAdminCleanup) return false;
  if (["BOARDING", "DEPARTED", "ARRIVED"].includes(trip.status)) return true;
  const originStop = trip.tripStops?.[0];
  return originStop?.actualDeparture !== null && originStop?.actualDeparture !== undefined;
}

export function isAnalyticsCompletedTrip(
  trip: { status: string },
  isAdminCleanup: boolean,
): boolean {
  if (isAdminCleanup) return false;
  return trip.status === "ARRIVED";
}

export function isReliabilityEligibleTrip(
  trip: {
    status: string;
    tripStops?: Array<{ position?: number; actualDeparture?: Date | null }>;
  },
  isAdminCleanup: boolean,
): boolean {
  if (isAdminCleanup) return false;
  const originStop = trip.tripStops?.[0];
  return originStop?.actualDeparture !== null && originStop?.actualDeparture !== undefined;
}

/**
 * Formats an instant as YYYY-MM-DD in Asia/Kuala_Lumpur.
 */
export function getMytCalendarDate(instant: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MYT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(instant);
}

/**
 * Parses a YYYY-MM-DD string into a UTC Date corresponding to 00:00:00 MYT (+08:00).
 * If isEndOfDayExclusive is true, returns the instant corresponding to (date + 1 day) 00:00:00 MYT.
 */
export function parseMytDateStringToUtc(
  dateStr: string,
  isEndOfDayExclusive = false,
): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid MYT date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Construct calendar date in UTC to check validity deterministically without local timezone influence
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (year < 100) {
    calendarCheck.setUTCFullYear(year);
  }

  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() + 1 !== month ||
    calendarCheck.getUTCDate() !== day
  ) {
    throw new Error(`Invalid MYT calendar date: "${dateStr}".`);
  }

  const targetDay = isEndOfDayExclusive ? day + 1 : day;
  // In UTC, MYT (UTC+8) 00:00 is UTC hour -8. Date.UTC handles negative hours and day rollovers.
  const result = new Date(Date.UTC(year, month - 1, targetDay, -8, 0, 0, 0));
  if (year < 100) {
    result.setUTCFullYear(year);
  }
  return result;
}

export interface MytPresetResult {
  readonly fromDateStr: string;
  readonly toDateStr: string;
  readonly fromUtc: Date;
  readonly toUtcExclusive: Date;
}

/**
 * Calculates deterministic MYT date range for presets (Last 7d, 30d, 90d).
 * 7d  = today + previous 6 days (7 calendar days total)
 * 30d = today + previous 29 days (30 calendar days total)
 * 90d = today + previous 89 days (90 calendar days total)
 */
export function calculateMytPresetRange(
  preset: "7d" | "30d" | "90d",
  clockNow: Date,
): MytPresetResult {
  const todayStr = getMytCalendarDate(clockNow);
  const [year, month, day] = todayStr.split("-").map(Number) as [number, number, number];

  const daysBack = preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
  const fromUtc = new Date(Date.UTC(year, month - 1, day - daysBack, -8, 0, 0, 0));
  const fromDateStr = getMytCalendarDate(fromUtc);
  const toUtcExclusive = new Date(Date.UTC(year, month - 1, day + 1, -8, 0, 0, 0));

  return {
    fromDateStr,
    toDateStr: todayStr,
    fromUtc,
    toUtcExclusive,
  };
}

export interface LineInsightCandidate {
  readonly lineCode: string;
  readonly lineName: string;
  readonly operatedTrips: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly unservedDemand: number;
  readonly actualDepartureSamples: number;
  readonly onTimeDepartureRate: number | null;
  readonly averageDepartureDelayMinutes: number | null;
}

export interface OverviewInsightCandidate {
  readonly eligibleBookingOutcomes: number;
  readonly noShowRate: number | null;
  readonly completedTripSamples: number;
  readonly totalLines: number;
}

export function buildOperationalInsights(
  lines: readonly LineInsightCandidate[],
  overview: OverviewInsightCandidate,
): OperationalInsight[] {
  const insights: OperationalInsight[] = [];

  // 1. Capacity Pressure per Line
  for (const line of lines) {
    if (
      line.operatedTrips >= 3 &&
      line.reservedSeatSegmentUtilization !== null &&
      line.reservedSeatSegmentUtilization >= 80 &&
      line.unservedDemand >= 1
    ) {
      insights.push({
        type: "CAPACITY_PRESSURE",
        severity: "warning",
        title: `Capacity Pressure on ${line.lineCode}`,
        message: `${line.lineName} (${line.lineCode}) demonstrates significant capacity pressure. Review peak-period capacity or trip frequency.`,
        evidence: `${line.reservedSeatSegmentUtilization}% reserved seat-segment utilization with ${line.unservedDemand} unserved passenger requests across ${line.operatedTrips} operated Trips.`,
        sampleSize: line.operatedTrips,
      });
    }
  }

  // 2. Reliability per Line
  for (const line of lines) {
    if (
      line.actualDepartureSamples >= 3 &&
      line.onTimeDepartureRate !== null &&
      line.onTimeDepartureRate < 80
    ) {
      insights.push({
        type: "RELIABILITY",
        severity: line.onTimeDepartureRate < 60 ? "danger" : "warning",
        title: `Punctuality Risk on ${line.lineCode}`,
        message: `${line.lineName} (${line.lineCode}) recorded sub-target on-time departure rates. Review timetable allowances and corridor traffic conditions.`,
        evidence: `${line.onTimeDepartureRate}% on-time departures (avg delay: ${line.averageDepartureDelayMinutes ?? 0}m) across ${line.actualDepartureSamples} measured departures.`,
        sampleSize: line.actualDepartureSamples,
      });
    }
  }

  // 3. No-Show Rate Overview
  if (
    overview.eligibleBookingOutcomes >= 10 &&
    overview.noShowRate !== null &&
    overview.noShowRate >= 10
  ) {
    insights.push({
      type: "NO_SHOW",
      severity: overview.noShowRate >= 20 ? "danger" : "warning",
      title: "Elevated Reservation No-Show Rate",
      message: "A high rate of uncancelled no-shows was detected, reducing effective seat inventory for other students.",
      evidence: `No-show rate reached ${overview.noShowRate}% across ${overview.eligibleBookingOutcomes} eligible booking outcomes.`,
      sampleSize: overview.eligibleBookingOutcomes,
    });
  }

  // 4. Insufficient Data Notice (if applicable)
  if (overview.completedTripSamples < 3) {
    insights.push({
      type: "INSUFFICIENT_DATA",
      severity: "info",
      title: "Baseline Operational Data Accumulating",
      message: "Complete additional scheduled Trips across service lines to unlock high-confidence capacity and reliability recommendations.",
      evidence: `${overview.completedTripSamples} completed Trips recorded in the selected period.`,
      sampleSize: overview.completedTripSamples,
    });
  }

  return insights;
}
