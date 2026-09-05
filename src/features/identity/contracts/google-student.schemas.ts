import { z } from "zod";

import { studentIdSchema } from "@/shared/validation/student-identity";

export const googleStudentCredentialSchema = z.object({
  credential: z.string().trim().min(20, "Google credential is required"),
});

export const completeGoogleStudentSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters").max(120),
  studentId: studentIdSchema,
});

export type CompleteGoogleStudentInput = z.infer<
  typeof completeGoogleStudentSchema
>;
