import { createHash } from "node:crypto";

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isEmailVerificationTokenUsable(
  token: { expiresAt: Date; consumedAt: Date | null },
  now: Date,
): boolean {
  return token.consumedAt === null && token.expiresAt.getTime() > now.getTime();
}

export function verificationDeliveryMode(
  runtime: "development" | "test" | "production",
): "DEVELOPMENT_PREVIEW" | "UNCONFIGURED" {
  return runtime === "production" ? "UNCONFIGURED" : "DEVELOPMENT_PREVIEW";
}
