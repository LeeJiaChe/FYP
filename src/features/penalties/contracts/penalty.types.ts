import type { z } from "zod";

import type {
  resolvePenaltyAppealSchema,
  submitPenaltyAppealSchema,
} from "./penalty.schemas";

export type SubmitPenaltyAppealInput = z.infer<
  typeof submitPenaltyAppealSchema
>;
export type ResolvePenaltyAppealInput = z.infer<
  typeof resolvePenaltyAppealSchema
>;
