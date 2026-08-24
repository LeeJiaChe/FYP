import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

export const penaltyIdSchema = uuidSchema;
export const appealIdSchema = uuidSchema;

export const submitPenaltyAppealSchema = z.object({
  reason: z.string().trim().min(10).max(1_000),
});

export const resolvePenaltyAppealSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminComment: z.string().trim().max(1_000).optional().default(""),
});
