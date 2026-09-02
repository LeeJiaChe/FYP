import { z } from "zod";
import type { OperationalInsight } from "../domain/metrics";

export const analyticsRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

export const operationsAnalyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  lineId: z.string().trim().uuid().optional(),
  direction: z.enum(["OUTBOUND", "INBOUND"]).optional(),
});

export type OperationsAnalyticsQuery = z.infer<typeof operationsAnalyticsQuerySchema>;

export interface LineDirectionDetail {
  readonly direction: "OUTBOUND" | "INBOUND";
  readonly scheduledTrips: number;
  readonly operatedTrips: number;
  readonly completedTrips: number;
  readonly boardedPassengers: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly eligibleBookingOutcomes: number;
  readonly noShowCount: number;
  readonly noShowRate: number | null;
  readonly actualDepartureSamples: number;
  readonly onTimeDepartureRate: number | null;
  readonly averageDepartureDelayMinutes: number | null;
  readonly unservedDemand: number;
  readonly waitlistExpired: number;
  readonly walkInsRejectedFull: number;
  readonly operationalCancellationCount: number;
}

export interface LinePerformanceRow {
  readonly lineId: string;
  readonly lineCode: string;
  readonly lineName: string;
  readonly scheduledTrips: number;
  readonly operatedTrips: number;
  readonly completedTrips: number;
  readonly boardedPassengers: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly eligibleBookingOutcomes: number;
  readonly noShowCount: number;
  readonly noShowRate: number | null;
  readonly actualDepartureSamples: number;
  readonly onTimeDepartureRate: number | null;
  readonly averageDepartureDelayMinutes: number | null;
  readonly unservedDemand: number;
  readonly waitlistExpired: number;
  readonly walkInsRejectedFull: number;
  readonly operationalCancellationCount: number;
  readonly directions: {
    readonly outbound: LineDirectionDetail;
    readonly inbound: LineDirectionDetail;
  };
}

export interface HourlyRidershipRow {
  readonly hour: number;
  readonly label: string;
  readonly boardedRidership: number;
  readonly byLine: Record<string, number>;
}

export interface DemandPressureRow {
  readonly lineId: string;
  readonly lineCode: string;
  readonly lineName: string;
  readonly unservedDemand: number;
  readonly waitlistExpired: number;
  readonly walkInsRejectedFull: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly operatedTrips: number;
  readonly pressureFlag: boolean;
}

export interface ReliabilityLineRow {
  readonly lineId: string;
  readonly lineCode: string;
  readonly lineName: string;
  readonly onTimeDepartureRate: number | null;
  readonly averageDepartureDelayMinutes: number | null;
  readonly maxDepartureDelayMinutes: number | null;
  readonly actualDepartureSamples: number;
  readonly operationalCancellations: number;
}

export interface FleetPerformanceRow {
  readonly busId: string;
  readonly plateNumber: string;
  readonly status: string;
  readonly operatedTrips: number;
  readonly completedTrips: number;
  readonly boardedPassengers: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly actualServiceHours: number | null;
  readonly operationalCancellationCount: number;
}

export interface AnalyticsOverview {
  readonly boardedPassengers: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly onTimeDepartureRate: number | null;
  readonly averageDepartureDelayMinutes: number | null;
  readonly noShowRate: number | null;
  readonly unservedDemand: number;
  readonly operationalCancellations: number;
  readonly totalScheduledTrips: number;
  readonly operatedTrips: number;
  readonly completedTrips: number;
  readonly eligibleBookingOutcomes: number;
  readonly noShowCount: number;
  readonly actualDepartureSamples: number;
  readonly waitlistExpired: number;
  readonly walkInsRejectedFull: number;
  readonly currentWaitingCount: number;
  readonly waitlistEntries: number;
  readonly waitlistPromoted: number;
  readonly waitlistFinalizedOutcomes: number;
  readonly promotionRate: number | null;
}

export interface AnalyticsDataQuality {
  readonly excludedAdministrativeCleanupTrips: number;
  readonly completedTripSamples: number;
  readonly actualDepartureSamples: number;
  readonly eligibleBookingOutcomes: number;
  readonly hasSufficientReliabilitySample: boolean;
  readonly hasSufficientNoShowSample: boolean;
  readonly prototypeData: boolean;
  readonly timezone: string;
}

export interface AvailableLineFilterOption {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface OperationsAnalyticsResponse {
  readonly range: {
    readonly from: string;
    readonly to: string;
    readonly timezone: string;
  };
  readonly filters: {
    readonly lineId: string | null;
    readonly direction: "OUTBOUND" | "INBOUND" | null;
  };
  readonly availableLines: readonly AvailableLineFilterOption[];
  readonly overview: AnalyticsOverview;
  readonly linePerformance: readonly LinePerformanceRow[];
  readonly hourlyRidership: readonly HourlyRidershipRow[];
  readonly demandPressure: readonly DemandPressureRow[];
  readonly reliability: {
    readonly overview: {
      readonly onTimeDepartureRate: number | null;
      readonly averageDepartureDelayMinutes: number | null;
      readonly maxDepartureDelayMinutes: number | null;
      readonly actualDepartureSamples: number;
      readonly operationalCancellations: number;
    };
    readonly byLine: readonly ReliabilityLineRow[];
  };
  readonly fleetPerformance: readonly FleetPerformanceRow[];
  readonly insights: readonly OperationalInsight[];
  readonly dataQuality: AnalyticsDataQuality;
}
