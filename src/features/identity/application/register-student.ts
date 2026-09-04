import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth";
import { productPolicy } from "@/shared/config/policies";
import { hashEmailVerificationToken } from "../domain/email-verification";
import { getEmailVerificationDelivery } from "../infrastructure/email-verification-delivery.server";
import {
  consumeEmailVerificationTokenRecord,
  createUnverifiedStudentRecord,
  findStudentIdentityRecord,
} from "../infrastructure/email-verification.prisma.server";

export class StudentRegistrationError extends Error {
  constructor(
    readonly code: "IDENTITY_EXISTS" | "DELIVERY_UNAVAILABLE" | "TOKEN_INVALID",
    message: string,
  ) {
    super(message);
  }
}

export async function registerStudent(input: {
  name: string;
  email: string;
  studentId?: string;
  password: string;
}) {
  const delivery = getEmailVerificationDelivery();
  if (!delivery.available) {
    throw new StudentRegistrationError(
      "DELIVERY_UNAVAILABLE",
      "Student email verification delivery is not configured",
    );
  }
  const studentId = input.studentId ?? `STU${Date.now().toString().slice(-6)}`;
  const existing = await findStudentIdentityRecord(input.email, studentId);
  if (existing) {
    throw new StudentRegistrationError(
      "IDENTITY_EXISTS",
      "User with this email or Student ID already exists",
    );
  }

  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  await createUnverifiedStudentRecord({
    name: input.name,
    email: input.email,
    studentId,
    passwordHash: await hashPassword(input.password),
    tokenHash: hashEmailVerificationToken(rawToken),
    expiresAt: new Date(now.getTime() + productPolicy.emailVerificationTtlMs),
    initialCredit: productPolicy.initialCredit,
  });
  const deliveryResult = await delivery.deliver({ email: input.email, rawToken });
  return { requiresEmailVerification: true, ...deliveryResult };
}

export async function verifyStudentEmail(rawToken: string) {
  const result = await consumeEmailVerificationTokenRecord(
    hashEmailVerificationToken(rawToken),
    new Date(),
  );
  if (!result) {
    throw new StudentRegistrationError(
      "TOKEN_INVALID",
      "Verification link is invalid, expired, or already used",
    );
  }
  return result;
}
