import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

export const createWalkInIntentSchema = z.object({
  tripId: uuidSchema,
  boardingTripStopId: uuidSchema,
  dropOffTripStopId: uuidSchema,
});

export const walkInIntentIdSchema = uuidSchema;

export type CreateWalkInIntentInput = z.infer<typeof createWalkInIntentSchema>;
