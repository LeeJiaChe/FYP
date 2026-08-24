import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

export const locationSourceSchema = z.enum(["SIMULATED", "GPS"]);

export const ingestLocationSchema = z.object({
  tripId: uuidSchema,
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  recordedAt: z.iso.datetime({ offset: true }),
  source: locationSourceSchema,
});

export const simulateLocationSchema = z.object({
  tripId: uuidSchema.optional(),
});

export const locationTripIdSchema = uuidSchema;

export type IngestLocationInput = z.infer<typeof ingestLocationSchema>;

