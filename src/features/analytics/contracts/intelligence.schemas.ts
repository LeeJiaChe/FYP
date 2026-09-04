import { z } from "zod";

import type { OperationsAnalyticsResponse } from "./analytics.schemas";

export const signalSeveritySchema = z.enum([
  "POSITIVE",
  "INFO",
  "WATCH",
  "MEDIUM",
  "HIGH",
]);
export const signalCategorySchema = z.enum([
  "DEMAND",
  "CAPACITY",
  "RELIABILITY",
  "FLEET",
  "PASSENGER_BEHAVIOUR",
  "DATA_QUALITY",
  "CURRENT_OPERATION",
]);
export const evidenceStrengthSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export type SignalSeverity = z.infer<typeof signalSeveritySchema>;
export type SignalCategory = z.infer<typeof signalCategorySchema>;
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;

export type AnalyticsSignalType =
  | "CAPACITY_PRESSURE"
  | "UNSERVED_DEMAND_SPIKE"
  | "RELIABILITY_DETERIORATION"
  | "RELIABILITY_IMPROVEMENT"
  | "RECURRING_LATE_DEPARTURES"
  | "DEMAND_SHIFT"
  | "LOW_FLEET_UTILISATION"
  | "HIGH_FLEET_CONCENTRATION"
  | "TURNAROUND_RISK"
  | "DEADHEAD_RISK"
  | "HIGH_NO_SHOW_RATE"
  | "DATA_QUALITY_WARNING"
  | "OVERDUE_UNSTARTED_TRIP"
  | "TRIP_WITHOUT_DRIVER"
  | "STALE_TELEMETRY"
  | "SIGNIFICANT_EXPECTED_DELAY"
  | "ACTIVE_DRIVER_CONFLICT"
  | "INSUFFICIENT_SAMPLE";

export interface EvidenceMetric {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly unit: "COUNT" | "PERCENT" | "MINUTES" | "HOURS" | "PERCENTAGE_POINTS";
  readonly sampleSize: number;
}

export interface AnalyticsSignal {
  readonly id: string;
  readonly type: AnalyticsSignalType;
  readonly severity: SignalSeverity;
  readonly category: SignalCategory;
  readonly scope: {
    readonly lineId?: string;
    readonly lineCode?: string;
    readonly direction?: "OUTBOUND" | "INBOUND";
    readonly timeBucket?: string;
    readonly busId?: string;
    readonly plateNumber?: string;
    readonly tripId?: string;
  };
  readonly headline: string;
  readonly observation: string;
  readonly deterministicInterpretation: string;
  readonly recommendedReview: string | null;
  readonly recommendationLevel: "OBSERVE" | "REVIEW" | "CONSIDER" | "IMMEDIATE_ATTENTION";
  readonly observedValue: number | null;
  readonly comparisonValue: number | null;
  readonly change: number | null;
  readonly sampleSize: number;
  readonly evidenceStrength: EvidenceStrength;
  readonly evidenceMetricKeys: readonly string[];
  readonly period: { readonly from: string; readonly to: string };
}

export interface TimeBucketIntelligenceRow {
  readonly lineId: string;
  readonly lineCode: string;
  readonly lineName: string;
  readonly direction: "OUTBOUND" | "INBOUND";
  readonly bucket: string;
  readonly label: string;
  readonly boardedPassengers: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly unservedDemand: number;
  readonly operatedTrips: number;
}

export interface OriginDestinationRow {
  readonly lineId: string;
  readonly lineCode: string;
  readonly direction: "OUTBOUND" | "INBOUND";
  readonly boardingStopCode: string;
  readonly boardingStopName: string;
  readonly dropOffStopCode: string;
  readonly dropOffStopName: string;
  readonly boardedReserved: number;
  readonly boardedWalkIn: number;
  readonly boardedJourneys: number;
  readonly unservedDemand: number;
}

export interface SegmentLoadRow {
  readonly lineId: string;
  readonly lineCode: string;
  readonly direction: "OUTBOUND" | "INBOUND";
  readonly fromStopCode: string;
  readonly fromStopName: string;
  readonly toStopCode: string;
  readonly toStopName: string;
  readonly reservedClaims: number;
  readonly standingClaims: number;
}

export interface FleetIntelligenceRow {
  readonly busId: string;
  readonly plateNumber: string;
  readonly scheduledTrips: number;
  readonly operatedTrips: number;
  readonly completedTrips: number;
  readonly actualServiceHours: number | null;
  readonly scheduledOperatingSpanHours: number | null;
  readonly scheduledIdleGapHours: number;
  readonly workloadSharePercent: number | null;
  readonly turnaroundAdvisories: number;
  readonly deadheadAdvisories: number;
}

export interface TripEvidenceRow {
  readonly tripId: string;
  readonly lineId: string;
  readonly lineCode: string;
  readonly direction: "OUTBOUND" | "INBOUND";
  readonly busId: string;
  readonly plateNumber: string;
  readonly departureTime: string;
  readonly status: string;
  readonly actualDepartureTime: string | null;
  readonly actualDepartureDelayMinutes: number | null;
  readonly boardedPassengers: number;
  readonly reservedSeatSegmentUtilization: number | null;
  readonly unservedDemand: number;
}

export interface AnalyticsSnapshot {
  readonly period: { readonly from: string; readonly to: string; readonly timezone: string };
  readonly comparisonPeriod: { readonly from: string; readonly to: string };
  readonly scope: OperationsAnalyticsResponse["filters"];
  readonly generatedAt: string;
  readonly fingerprint: string;
  readonly eligibleTripCount: number;
  readonly dataQuality: OperationsAnalyticsResponse["dataQuality"] & {
    readonly missingActualDepartureCount: number;
    readonly comparisonAvailable: boolean;
    readonly limitations: readonly string[];
  };
  readonly network: {
    readonly current: OperationsAnalyticsResponse["overview"];
    readonly previous: OperationsAnalyticsResponse["overview"];
    readonly changes: Readonly<Record<string, number | null>>;
  };
  readonly serviceLines: OperationsAnalyticsResponse["linePerformance"];
  readonly previousServiceLines: OperationsAnalyticsResponse["linePerformance"];
  readonly timeBuckets: readonly TimeBucketIntelligenceRow[];
  readonly originDestination: readonly OriginDestinationRow[];
  readonly segmentLoads: readonly SegmentLoadRow[];
  readonly reliability: OperationsAnalyticsResponse["reliability"];
  readonly demand: OperationsAnalyticsResponse["demandPressure"];
  readonly fleet: readonly FleetIntelligenceRow[];
  readonly passengerBehaviour: {
    readonly noShowRate: number | null;
    readonly eligibleBookingOutcomes: number;
    readonly waitlistPromotionRate: number | null;
    readonly finalizedWaitlistOutcomes: number;
    readonly boardedPassengers: number;
    readonly unservedDemand: number;
  };
  readonly tripEvidence: readonly TripEvidenceRow[];
  readonly evidence: Readonly<Record<string, EvidenceMetric>>;
  readonly signals: readonly AnalyticsSignal[];
  readonly focusSignalId: string | null;
}

export const geminiInsightSchema = z.object({
  signalId: z.string().min(1),
  severity: signalSeveritySchema,
  category: signalCategorySchema,
  headline: z.string().trim().min(1).max(140),
  observation: z.string().trim().min(1).max(500),
  interpretation: z.string().trim().min(1).max(500),
  evidenceMetricKeys: z.array(z.string().min(1)).min(1).max(12),
  recommendedReview: z.string().trim().max(400).nullable(),
  confidence: evidenceStrengthSchema,
  limitations: z.array(z.string().trim().min(1).max(240)).max(8),
});

export const geminiIntelligenceSchema = z.object({
  summary: z.string().trim().min(1).max(800),
  overallState: z.enum([
    "HEALTHY",
    "MIXED",
    "ATTENTION_REQUIRED",
    "INSUFFICIENT_DATA",
  ]),
  insights: z.array(geminiInsightSchema).max(5),
});

export type GeminiIntelligence = z.infer<typeof geminiIntelligenceSchema>;

export const askIntelligenceInputSchema = z.object({
  question: z.string().trim().min(4).max(500),
  from: z.coerce.date(),
  to: z.coerce.date(),
  lineId: z.string().trim().uuid().optional(),
  direction: z.enum(["OUTBOUND", "INBOUND"]).optional(),
});

export const interpretIntelligenceInputSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  from: z.coerce.date(),
  to: z.coerce.date(),
  lineId: z.string().trim().uuid().optional(),
  direction: z.enum(["OUTBOUND", "INBOUND"]).optional(),
});

export const askIntelligenceAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(1500),
  evidenceMetricKeys: z.array(z.string().min(1)).min(1).max(12),
  signalIds: z.array(z.string().min(1)).max(8),
  suggestedAction: z
    .object({
      type: z.enum(["FILTER_LINE", "FILTER_DIRECTION", "OPEN_TRIP", "NONE"]),
      lineId: z.string().nullable(),
      direction: z.enum(["OUTBOUND", "INBOUND"]).nullable(),
      tripId: z.string().nullable(),
    })
    .nullable(),
  limitations: z.array(z.string().trim().min(1).max(240)).max(8),
});

export type AskIntelligenceAnswer = z.infer<typeof askIntelligenceAnswerSchema>;

export interface OperationsIntelligenceResponse {
  readonly analytics: OperationsAnalyticsResponse;
  readonly snapshot: AnalyticsSnapshot;
  readonly interpretation: GeminiIntelligence | null;
  readonly assistant: {
    readonly status: "READY" | "UPDATING" | "DISABLED" | "UNAVAILABLE";
    readonly model: string | null;
    readonly cached: boolean;
    readonly message: string | null;
  };
  readonly history: readonly {
    fingerprint: string;
    period: AnalyticsSnapshot["period"];
    model: string;
    generatedAt: string;
    headlines: readonly string[];
  }[];
}

export interface OperationsInterpretationResponse {
  readonly fingerprint: string;
  readonly interpretation: GeminiIntelligence | null;
  readonly assistant: OperationsIntelligenceResponse["assistant"];
  readonly history: OperationsIntelligenceResponse["history"];
}
