import { z } from "zod";

export const STUDENT_EMAIL_DOMAIN = "student.tarc.edu.my";

export const studentEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address")
  .refine(
    (email) => email.endsWith(`@${STUDENT_EMAIL_DOMAIN}`),
    `Student email must use @${STUDENT_EMAIL_DOMAIN}`,
  );

export const studentIdSchema = z
  .string()
  .trim()
  .min(1, "Student ID is required")
  .transform((studentId) => studentId.toUpperCase());

export const studentLoginIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Email or Student ID is required")
  .transform((identifier) =>
    identifier.includes("@")
      ? identifier.toLowerCase()
      : identifier.toUpperCase(),
  );
