import { createHash, randomBytes } from "node:crypto";

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createPasswordResetToken(
  now: Date,
  ttlMs: number,
  createRawToken: () => string = () => randomBytes(32).toString("base64url"),
) {
  const rawToken = createRawToken();
  return {
    rawToken,
    tokenHash: hashPasswordResetToken(rawToken),
    expiresAt: new Date(now.getTime() + ttlMs),
  };
}

export function isPasswordResetTokenUsable(
  token: { expiresAt: Date; consumedAt: Date | null },
  now: Date,
): boolean {
  return token.consumedAt === null && token.expiresAt.getTime() > now.getTime();
}
