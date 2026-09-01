import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

export const tripIdSchema = uuidSchema;
export const passTokenSchema = z.object({
  token: z.string().trim().min(20).max(4_096),
});

export const manualBoardingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("RESERVED"), bookingId: uuidSchema }),
  z.object({ kind: z.literal("WALK_IN"), walkInIntentId: uuidSchema }),
]);

export const alightingSchema = z.union([
  z.object({ mode: z.literal("QR"), token: z.string().trim().min(20).max(4_096) }),
  z.object({
    mode: z.literal("MANUAL"),
    kind: z.enum(["RESERVED", "WALK_IN"]),
    recordId: uuidSchema,
  }),
]);

export const alightingPassSchema = z.object({
  kind: z.enum(["RESERVED", "WALK_IN"]),
  recordId: uuidSchema,
});

export const tripProgressSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("START_BOARDING") }),
  z.object({ action: z.literal("ARRIVE_NEXT_STOP") }),
  z.object({ action: z.literal("DEPART_CURRENT_STOP") }),
  z.object({
    action: z.literal("SET_DELAY"),
    delayMinutes: z.number().int().min(0).max(24 * 60),
    reason: z.string().trim().min(1).max(500),
  }),
]);

export type ManualBoardingInput = z.infer<typeof manualBoardingSchema>;
export type AlightingInput = z.infer<typeof alightingSchema>;
export type AlightingPassInput = z.infer<typeof alightingPassSchema>;
export type TripProgressInput = z.infer<typeof tripProgressSchema>;
