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
  blockId: z
    .union([z.string().uuid("Invalid ServiceBlock ID"), z.literal("")])
    .optional()
    .nullable()
    .transform((value) => value || undefined),
  departureTime: parseableDatetime,
});

export const createServiceBlockSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((value) => value.toUpperCase()),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  busId: z.string().uuid("Bus selection is required"),
});

export const listTripsQuerySchema = z.object({
  routeId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const tripIdSchema = uuidSchema;

export const cancelTripSchema = z.object({
  reason: z.string().trim().min(3).max(240),
});

export const updateScheduledTripSchema = z
  .object({
    departureTime: parseableDatetime.optional(),
    driverId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (input) => input.departureTime !== undefined || input.driverId !== undefined,
    "At least one schedulable field is required",
  );

const serviceTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const bulkScheduleSchema = z
  .object({
    routeId: z.string().uuid(),
    serviceDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    serviceDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    startTime: serviceTimeSchema,
    endTime: serviceTimeSchema,
    headwayMinutes: z.number().int().min(5).max(240),
    busIds: z.array(z.string().uuid()).min(1).max(20),
    driverIds: z.array(z.string().uuid()).max(20).default([]),
    blockId: z.string().uuid().optional(),
  })
  .refine((input) => input.serviceDateFrom <= input.serviceDateTo, {
    message: "Service date range is reversed",
    path: ["serviceDateTo"],
  });

type ParsedScheduleTripInput = z.infer<typeof scheduleTripSchema>;
export type ScheduleTripInput = Omit<
  ParsedScheduleTripInput,
  "driverId" | "blockId"
> & {
  driverId?: string;
  blockId?: string;
};
export type CreateServiceBlockInput = z.infer<typeof createServiceBlockSchema>;
export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
export type CancelTripInput = z.infer<typeof cancelTripSchema>;
export type UpdateScheduledTripInput = z.infer<typeof updateScheduledTripSchema>;
export type BulkScheduleInput = z.infer<typeof bulkScheduleSchema>;
