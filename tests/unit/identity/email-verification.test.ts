import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canStudentIdentityAuthenticate,
  createEmailVerificationToken,
  hashEmailVerificationToken,
  isEmailVerificationTokenUsable,
  shouldRotateVerificationToken,
  verificationDeliveryMode,
} from "@/features/identity/domain/email-verification";

describe("verified student identity", () => {
  it("stores only a deterministic hash of the one-time token", () => {
    assert.match(hashEmailVerificationToken("secret-token"), /^[a-f0-9]{64}$/);
    assert.doesNotMatch(hashEmailVerificationToken("secret-token"), /secret-token/);
  });

  it("accepts only unconsumed tokens before expiry", () => {
    const now = new Date("2026-09-04T00:00:00Z");
    assert.equal(isEmailVerificationTokenUsable({ expiresAt: new Date("2026-09-04T00:01:00Z"), consumedAt: null }, now), true);
    assert.equal(isEmailVerificationTokenUsable({ expiresAt: now, consumedAt: null }, now), false);
    assert.equal(isEmailVerificationTokenUsable({ expiresAt: new Date("2026-09-04T00:01:00Z"), consumedAt: now }, now), false);
  });

  it("never exposes a preview delivery in production", () => {
    assert.equal(verificationDeliveryMode("development"), "DEVELOPMENT_PREVIEW");
    assert.equal(verificationDeliveryMode("production"), "UNCONFIGURED");
  });

  it("keeps explicitly labelled legacy prototype Students usable", () => {
    assert.equal(
      canStudentIdentityAuthenticate({
        assurance: "LEGACY_PROTOTYPE",
        emailVerifiedAt: null,
      }),
      true,
    );
    assert.equal(
      canStudentIdentityAuthenticate({
        assurance: "EMAIL_UNVERIFIED",
        emailVerifiedAt: null,
      }),
      false,
    );
    assert.equal(
      canStudentIdentityAuthenticate({
        assurance: "EMAIL_VERIFIED",
        emailVerifiedAt: new Date("2026-09-04T00:00:00Z"),
      }),
      true,
    );
  });

  it("rotates verification only for pending self-registered Students", () => {
    assert.equal(
      shouldRotateVerificationToken({
        role: "STUDENT",
        studentIdentityAssurance: "EMAIL_UNVERIFIED",
      }),
      true,
    );
    assert.equal(
      shouldRotateVerificationToken({
        role: "STUDENT",
        studentIdentityAssurance: "EMAIL_VERIFIED",
      }),
      false,
    );
    assert.equal(
      shouldRotateVerificationToken({
        role: "STUDENT",
        studentIdentityAssurance: "LEGACY_PROTOTYPE",
      }),
      false,
    );
    assert.equal(shouldRotateVerificationToken(null), false);
  });

  it("creates expiring hashed tokens and rotates raw token material", () => {
    const now = new Date("2026-09-04T00:00:00Z");
    const first = createEmailVerificationToken(now, 60_000, () => "first-token");
    const second = createEmailVerificationToken(now, 60_000, () => "second-token");
    assert.equal(first.expiresAt.toISOString(), "2026-09-04T00:01:00.000Z");
    assert.notEqual(first.rawToken, second.rawToken);
    assert.notEqual(first.tokenHash, second.tokenHash);
    assert.doesNotMatch(first.tokenHash, /first-token/);
  });
});
