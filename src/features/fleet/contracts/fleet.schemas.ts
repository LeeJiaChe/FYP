import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

const routeStopSchema = z.object({
  stopId: uuidSchema,
  travelDurationToNextMinutes: z.number().int().positive().nullable(),
});

export const stopInputSchema = z.object({
  code: z.string().trim().min(1).max(32).transform((code) => code.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createStopSchema = stopInputSchema;

export const updateStopSchema = stopInputSchema.partial().extend({
  id: uuidSchema,
});

export const createRouteSchema = z.object({
  lineId: uuidSchema,
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  name: z.string().trim().min(2).max(120),
  stops: z.array(routeStopSchema).min(2).max(5),
});

export const updateRouteSchema = createRouteSchema.partial().extend({
  id: z.string().uuid(),
});

export const createServiceLineSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
});

export const updateServiceLineSchema = createServiceLineSchema.partial().extend({
  id: uuidSchema,
});

const plateNumberSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .transform((plateNumber) => plateNumber.toUpperCase());

export const createBusSchema = z.object({
  plateNumber: plateNumberSchema,
  seatedCapacity: z.number().int().positive(),
  standingCapacity: z.number().int().nonnegative(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "RETIRED"]).default("ACTIVE"),
});

export const updateBusSchema = createBusSchema.partial().extend({
  id: uuidSchema,
});

export type CreateStopInput = z.infer<typeof createStopSchema>;
export type UpdateStopInput = z.infer<typeof updateStopSchema>;
export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;
export type CreateServiceLineInput = z.infer<typeof createServiceLineSchema>;
export type UpdateServiceLineInput = z.infer<typeof updateServiceLineSchema>;
export type CreateBusInput = z.infer<typeof createBusSchema>;
export type UpdateBusInput = z.infer<typeof updateBusSchema>;
