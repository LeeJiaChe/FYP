import { z } from "zod";
import {
  studentEmailSchema,
  studentIdSchema,
  studentLoginIdentifierSchema,
} from "@/shared/validation/student-identity";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: studentEmailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  studentId: studentIdSchema,
});

export const loginSchema = z.object({
  emailOrStudentId: studentLoginIdentifierSchema,
  password: z.string().min(1, "Password is required"),
});

export const createBusSchema = z.object({
  plateNumber: z.string().min(2, "Plate number required"),
  seatedCapacity: z.number().int().positive("Seated capacity must be positive"),
  standingCapacity: z.number().int().nonnegative("Standing capacity cannot be negative"),
  status: z.enum(["ACTIVE", "MAINTENANCE", "RETIRED"]).default("ACTIVE"),
});

export const updateBusSchema = createBusSchema.partial().extend({
  id: z.string().min(1, "Bus ID required"),
});
