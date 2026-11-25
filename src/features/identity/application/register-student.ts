import { hashPassword } from "@/lib/auth";
import { productPolicy } from "@/shared/config/policies";
import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
  shouldRotateVerificationToken,
} from "../domain/email-verification";
import { getTransactionalEmailDelivery } from "../infrastructure/transactional-email-composition.server";
import {
  consumeEmailVerificationTokenRecord,
  createUnverifiedStudentRecord,
  findStudentIdentityRecord,
  findIdentityForVerificationRecord,
  rotateEmailVerificationTokenRecord,
} from "../infrastructure/email-verification.prisma.server";

export class StudentRegistrationError extends Error {
  constructor(
    readonly code:
      | "IDENTITY_EXISTS"
      | "DELIVERY_UNAVAILABLE"
      | "TOKEN_INVALID"
      | "REGISTRATION_DISABLED",
    message: string,
  ) {
    super(message);
  }
}

export async function registerStudent(input: {
  name: string;
  email: string;
  studentId: string;
  password: string;
}) {
  const delivery = await getTransactionalEmailDelivery();
  if (!delivery.available) {
    return { requiresEmailVerification: true };
  }
  const existing = await findStudentIdentityRecord(input.email, input.studentId);
  if (existing) {
    if (!delivery.preview) return { requiresEmailVerification: true };
    throw new StudentRegistrationError(
      "IDENTITY_EXISTS",
      "User with this email or Student ID already exists",
    );
  }

  const now = new Date();
  const token = createEmailVerificationToken(
    now,
    productPolicy.emailVerificationTtlMs,
  );
  try {
    await createUnverifiedStudentRecord({
      name: input.name,
      email: input.email,
      studentId: input.studentId,
      passwordHash: await hashPassword(input.password),
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      initialCredit: productPolicy.initialCredit,
    });
    const deliveryResult = await delivery.deliverStudentVerification({
      email: input.email,
      rawToken: token.rawToken,
    });
    return { requiresEmailVerification: true, ...deliveryResult };
  } catch (error) {
    if (delivery.preview) throw error;
    return { requiresEmailVerification: true };
  }
}

export async function resendStudentVerification(email: string) {
  const delivery = await getTransactionalEmailDelivery();
  if (!delivery.available) return { accepted: true };
  const identity = await findIdentityForVerificationRecord(email);
  if (!shouldRotateVerificationToken(identity)) {
    return { accepted: true };
  }
  if (!identity) return { accepted: true };

  const now = new Date();
  const token = createEmailVerificationToken(
    now,
    productPolicy.emailVerificationTtlMs,
  );
  await rotateEmailVerificationTokenRecord({
    userId: identity.id,
    tokenHash: token.tokenHash,
    expiresAt: token.expiresAt,
    now,
  });
  const result = await delivery.deliverStudentVerification({
    email: identity.email,
    rawToken: token.rawToken,
  });
  return { accepted: true, ...result };
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
