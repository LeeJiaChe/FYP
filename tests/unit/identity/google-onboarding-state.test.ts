import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";

import {
  createGoogleOnboardingState,
  GOOGLE_ONBOARDING_COOKIE,
  googleOnboardingCookieOptions,
  verifyGoogleOnboardingState,
} from "@/features/identity/infrastructure/google-onboarding-state.server";

const identity = {
  provider: "GOOGLE" as const,
  providerSubject: "stable-google-subject",
  email: "student@student.tarc.edu.my",
  name: "Student Name",
  hostedDomain: "student.tarc.edu.my",
};
const configuration = {
  signingSecret: "onboarding-test-signing-secret-at-least-32-chars",
  runtime: "test" as const,
  hostedDomain: "student.tarc.edu.my",
  ttlMs: 10 * 60_000,
};

describe("Google Student onboarding state", () => {
  it("binds verified identity in a short-lived purpose-specific HttpOnly cookie", () => {
    const issuedAt = new Date("2026-09-05T08:00:00Z");
    const token = createGoogleOnboardingState(identity, configuration, issuedAt);
    assert.deepEqual(
      verifyGoogleOnboardingState(token, configuration, new Date("2026-09-05T08:05:00Z")),
      identity,
    );
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    assert.equal(decoded.aud, "google-student-onboarding");
    assert.equal(decoded.purpose, "COMPLETE_GOOGLE_STUDENT");
    assert.equal(decoded.userId, undefined);
    assert.equal(decoded.providerSubject, identity.providerSubject);
    assert.throws(() => jwt.verify(token, configuration.signingSecret));
    assert.equal(GOOGLE_ONBOARDING_COOKIE, "fyp_google_student_onboarding");
    const options = googleOnboardingCookieOptions(configuration);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, "/");
    assert.ok(options.maxAge <= 10 * 60);
  });

  it("expires and cannot be repurposed as an application session", () => {
    const issuedAt = new Date("2026-09-05T08:00:00Z");
    const token = createGoogleOnboardingState(identity, configuration, issuedAt);
    assert.equal(
      verifyGoogleOnboardingState(token, configuration, new Date("2026-09-05T08:11:00Z")),
      null,
    );
    assert.equal(verifyGoogleOnboardingState("not-a-token", configuration, issuedAt), null);
    const payload = jwt.decode(token) as jwt.JwtPayload;
    assert.notEqual(payload.aud, "fyp-application-session");
    assert.equal(payload.userId, undefined);
  });
});
