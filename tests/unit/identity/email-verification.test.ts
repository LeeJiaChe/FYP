import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashEmailVerificationToken,
  isEmailVerificationTokenUsable,
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
});
