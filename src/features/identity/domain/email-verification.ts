import { createHash, randomBytes } from "node:crypto";

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createEmailVerificationToken(
  now: Date,
  ttlMs: number,
  createRawToken: () => string = () => randomBytes(32).toString("base64url"),
) {
  const rawToken = createRawToken();
  return {
    rawToken,
    tokenHash: hashEmailVerificationToken(rawToken),
    expiresAt: new Date(now.getTime() + ttlMs),
  };
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

export type StudentIdentityAssurance =
  | "LEGACY_PROTOTYPE"
  | "EMAIL_UNVERIFIED"
  | "EMAIL_VERIFIED";

export function canStudentIdentityAuthenticate(input: {
  assurance: StudentIdentityAssurance | null;
  emailVerifiedAt: Date | null;
}): boolean {
  return (
    input.assurance === "LEGACY_PROTOTYPE" ||
    (input.assurance === "EMAIL_VERIFIED" && input.emailVerifiedAt !== null)
  );
}

export function shouldRotateVerificationToken(input: {
  role: string;
  studentIdentityAssurance: StudentIdentityAssurance | null;
} | null): boolean {
  return (
    input?.role === "STUDENT" &&
    input.studentIdentityAssurance === "EMAIL_UNVERIFIED"
  );
}
