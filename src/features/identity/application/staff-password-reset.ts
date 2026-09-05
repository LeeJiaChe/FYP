import { hashPassword } from "@/lib/auth";
import { productPolicy } from "@/shared/config/policies";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "../domain/password-reset";
import type { TransactionalEmailDelivery } from "../infrastructure/transactional-email.server";

export const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an eligible staff account exists, a password reset link has been prepared.";

export interface StaffPasswordResetStore {
  createIfEligible(input: {
    email: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<{ email: string } | null>;
  consume(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<"RESET" | "INVALID">;
}

export class StaffPasswordResetError extends Error {
  constructor(readonly code: "TOKEN_INVALID") {
    super("Reset link is invalid, expired, or already used.");
    this.name = "StaffPasswordResetError";
  }
}

export async function requestStaffPasswordReset(input: {
  email: string;
  store: StaffPasswordResetStore;
  delivery: TransactionalEmailDelivery;
  now?: Date;
}) {
  if (!input.delivery.available) {
    return { message: PASSWORD_RESET_REQUEST_MESSAGE };
  }
  const now = input.now ?? new Date();
  const token = createPasswordResetToken(
    now,
    productPolicy.passwordResetTtlMs,
  );
  let target: { email: string } | null;
  try {
    target = await input.store.createIfEligible({
      email: input.email,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      now,
    });
  } catch {
    return { message: PASSWORD_RESET_REQUEST_MESSAGE };
  }

  let previewUrl: string | undefined;
  if (target) {
    try {
      const deliveryResult = await input.delivery.deliverStaffPasswordReset({
        email: target.email,
        rawToken: token.rawToken,
      });
      previewUrl = deliveryResult.previewUrl;
    } catch {
      // The public request remains generic. The raw token is neither returned
      // nor logged, so an undelivered stored hash cannot be used.
    }
  }
  return { message: PASSWORD_RESET_REQUEST_MESSAGE, previewUrl };
}

export async function resetStaffPassword(input: {
  rawToken: string;
  password: string;
  store: StaffPasswordResetStore;
  now?: Date;
}) {
  let result: "RESET" | "INVALID";
  try {
    result = await input.store.consume({
      tokenHash: hashPasswordResetToken(input.rawToken),
      passwordHash: await hashPassword(input.password),
      now: input.now ?? new Date(),
    });
  } catch {
    result = "INVALID";
  }
  if (result !== "RESET") {
    throw new StaffPasswordResetError("TOKEN_INVALID");
  }
  return { reset: true as const };
}
