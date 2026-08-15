import { z } from "zod";

export const analyticsRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;

