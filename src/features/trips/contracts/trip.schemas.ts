import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

const parseableDatetime = z.string().datetime({ offset: true });

export const scheduleTripSchema = z.object({
  routeId: z.string().uuid("Route selection is required"),
  busId: z.string().uuid("Bus selection is required"),
  driverId: z
    .union([z.string().uuid("Invalid driver ID"), z.literal("")])
    .optional()
    .nullable()
    .transform((value) => value || undefined),
  departureTime: parseableDatetime,
});

export const listTripsQuerySchema = z.object({
  routeId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const tripIdSchema = uuidSchema;

export type ScheduleTripInput = z.infer<typeof scheduleTripSchema>;
export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
