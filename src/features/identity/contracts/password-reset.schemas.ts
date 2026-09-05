import { z } from "zod";

export const applicationPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid staff email"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20, "Reset link is invalid"),
    password: applicationPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
