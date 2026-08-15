import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

const driverEmail = z.string().trim().toLowerCase().email().max(254);
const driverName = z.string().trim().min(2).max(120);

export const createDriverSchema = z.object({
  name: driverName,
  email: driverEmail,
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
});

export const updateDriverSchema = z
  .object({
    id: uuidSchema,
    name: driverName.optional(),
    email: driverEmail.optional(),
  })
  .refine((input) => input.name !== undefined || input.email !== undefined, {
    message: "At least one driver profile field is required",
  });

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
