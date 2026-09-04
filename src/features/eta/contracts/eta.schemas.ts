import { z } from "zod";

export const etaSourceSchema = z.enum(["TRAFFIC_AWARE", "SCHEDULE_ESTIMATE"]);
export type EtaSource = z.infer<typeof etaSourceSchema>;

export const etaFallbackReasonSchema = z
  .enum([
    "DISABLED",
    "NO_API_KEY",
    "NO_LOCATION",
    "STALE_LOCATION",
    "API_TIMEOUT",
    "API_ERROR",
    "NO_ROUTE",
    "INVALID_ROUTE_DATA",
  ])
  .nullable();
export type EtaFallbackReason = z.infer<typeof etaFallbackReasonSchema>;

export const stopEtaSchema = z.object({
  tripStopId: z.string().uuid(),
  stopCode: z.string(),
  stopName: z.string(),
  position: z.number().int(),
  plannedArrival: z.string().datetime(),
  estimatedArrival: z.string().datetime(),
  minutesAway: z.number().int().min(0),
  scheduleVarianceMinutes: z.number().int(),
  cumulativeDistanceMeters: z.number().int().nullable(),
});
export type StopEta = z.infer<typeof stopEtaSchema>;

export const tripEtaSchema = z.object({
  tripId: z.string(),
  tripStatus: z.enum([
    "NOT_STARTED",
    "BOARDING",
    "DEPARTED",
    "ARRIVED",
    "CANCELLED",
  ]),
  source: etaSourceSchema,
  fallbackReason: etaFallbackReasonSchema,
  locationSource: z.enum(["SIMULATED", "GPS"]).nullable(),
  locationRecordedAt: z.string().datetime().nullable(),
  locationAgeMs: z.number().int().min(0).nullable(),
  generatedAt: z.string().datetime(),
  trafficImpactMinutes: z.number().int().min(0).nullable(),
  stopEstimates: z.array(stopEtaSchema),
});
export type TripEta = z.infer<typeof tripEtaSchema>;

export const studentBookingEtaSchema = z.object({
  bookingId: z.string(),
  tripId: z.string(),
  tripStatus: z.enum([
    "NOT_STARTED",
    "BOARDING",
    "DEPARTED",
    "ARRIVED",
    "CANCELLED",
  ]),
  targetStopId: z.string().uuid(),
  targetStopName: z.string(),
  targetStopRole: z.enum(["BOARDING", "DROP_OFF"]),
  isBoarded: z.boolean(),
  isPassed: z.boolean(),
  minutesAway: z.number().int().min(0).nullable(),
  estimatedArrival: z.string().datetime().nullable(),
  plannedArrival: z.string().datetime(),
  scheduleVarianceMinutes: z.number().int().nullable(),
  trafficImpactMinutes: z.number().int().min(0).nullable(),
  source: etaSourceSchema,
  fallbackReason: etaFallbackReasonSchema,
  locationSource: z.enum(["SIMULATED", "GPS"]).nullable(),
  locationAgeMs: z.number().int().min(0).nullable(),
  generatedAt: z.string().datetime(),
});
export type StudentBookingEta = z.infer<typeof studentBookingEtaSchema>;
