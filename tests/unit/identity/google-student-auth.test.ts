import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authenticateGoogleStudent,
  completeGoogleStudentOnboarding,
  GoogleStudentAuthError,
  type GoogleCredentialVerifier,
  type GoogleStudentIdentityStore,
} from "@/features/identity/application/google-student-auth";
import {
  GoogleIdentityClaimsError,
  type GoogleIdTokenClaims,
  validateGoogleStudentClaims,
} from "@/features/identity/domain/google-student-identity";

const now = new Date("2026-09-05T08:00:00Z");
const clientId = "web-client.apps.googleusercontent.com";
const hostedDomain = "student.tarc.edu.my";
const validClaims: GoogleIdTokenClaims = {
  sub: "google-subject-123",
  email: "Student.One@Student.Tarc.Edu.My",
  email_verified: true,
  hd: hostedDomain,
  name: "Student One",
  aud: clientId,
  iss: "https://accounts.google.com",
  exp: Math.floor(now.getTime() / 1_000) + 300,
};

function claims(overrides: Partial<GoogleIdTokenClaims> = {}) {
  return { ...validClaims, ...overrides };
}

function verifier(result: GoogleIdTokenClaims = validClaims): GoogleCredentialVerifier {
  return { async verifyIdToken() { return result; } };
}

const student = {
  id: "student-user-id",
  name: "Student One",
  email: "student.one@student.tarc.edu.my",
  role: "STUDENT" as const,
  studentId: "24WAB09999",
  creditScore: 100,
  sessionVersion: 1,
};

describe("Google Workspace Student identity", () => {
  it("accepts an authoritative TAR UMT Workspace identity and keeps Google sub", () => {
    const identity = validateGoogleStudentClaims({
      claims: validClaims,
      clientId,
      hostedDomain,
      now,
    });
    assert.equal(identity.providerSubject, "google-subject-123");
    assert.equal(identity.email, "student.one@student.tarc.edu.my");
    assert.equal(identity.provider, "GOOGLE");
  });

  for (const [name, overrides, code] of [
    ["personal Gmail", { email: "person@gmail.com", hd: undefined }, "EMAIL_DOMAIN_NOT_ALLOWED"],
    ["another Workspace domain", { email: "person@other.edu", hd: "other.edu" }, "EMAIL_DOMAIN_NOT_ALLOWED"],
    ["missing hosted domain", { hd: undefined }, "HOSTED_DOMAIN_MISSING"],
    ["wrong hosted domain", { hd: "staff.tarc.edu.my" }, "HOSTED_DOMAIN_NOT_ALLOWED"],
    ["unverified email", { email_verified: false }, "EMAIL_UNVERIFIED"],
  ] as const) {
    it(`rejects ${name}`, () => {
      assert.throws(
        () => validateGoogleStudentClaims({ claims: claims(overrides), clientId, hostedDomain, now }),
        (error) => error instanceof GoogleIdentityClaimsError && error.code === code,
      );
    });
  }

  it("rejects wrong audience, issuer, and expiry even after verifier output", () => {
    assert.throws(
      () => validateGoogleStudentClaims({ claims: claims({ aud: "other-client" }), clientId, hostedDomain, now }),
      /AUDIENCE_MISMATCH/,
    );
    assert.throws(
      () => validateGoogleStudentClaims({ claims: claims({ iss: "https://attacker.example" }), clientId, hostedDomain, now }),
      /ISSUER_INVALID/,
    );
    assert.throws(
      () => validateGoogleStudentClaims({ claims: claims({ exp: Math.floor(now.getTime() / 1_000) }), clientId, hostedDomain, now }),
      /TOKEN_EXPIRED/,
    );
  });

  it("rejects a failed official verifier result", async () => {
    const failingVerifier: GoogleCredentialVerifier = {
      async verifyIdToken() { throw new Error("signature invalid"); },
    };
    const store = { async resolveOrLink() { return { kind: "ONBOARDING_REQUIRED" as const }; }, async completeOnboarding() { return { kind: "IDENTITY_CONFLICT" as const }; } };
    await assert.rejects(
      authenticateGoogleStudent({ credential: "signed-google-id-token", clientId, hostedDomain, verifier: failingVerifier, store, now }),
      (error) => error instanceof GoogleStudentAuthError && error.code === "INVALID_GOOGLE_IDENTITY",
    );
  });

  it("logs in an already-linked Student by provider subject", async () => {
    let observedSubject = "";
    const store: GoogleStudentIdentityStore = {
      async resolveOrLink(identity) {
        observedSubject = identity.providerSubject;
        return { kind: "AUTHENTICATED", user: student };
      },
      async completeOnboarding() { return { kind: "IDENTITY_CONFLICT" }; },
    };
    const result = await authenticateGoogleStudent({ credential: "signed-google-id-token", clientId, hostedDomain, verifier: verifier(), store, now });
    assert.equal(result.kind, "AUTHENTICATED");
    assert.equal(observedSubject, validClaims.sub);
  });

  it("safely links an existing matching Student through the store transaction", async () => {
    let linkedEmail = "";
    const store: GoogleStudentIdentityStore = {
      async resolveOrLink(identity) {
        linkedEmail = identity.email;
        return { kind: "AUTHENTICATED", user: student };
      },
      async completeOnboarding() { return { kind: "IDENTITY_CONFLICT" }; },
    };
    const result = await authenticateGoogleStudent({ credential: "signed-google-id-token", clientId, hostedDomain, verifier: verifier(), store, now });
    assert.equal(result.kind, "AUTHENTICATED");
    assert.equal(linkedEmail, student.email);
  });

  it("rejects matching Driver/Admin emails instead of linking", async () => {
    const store: GoogleStudentIdentityStore = {
      async resolveOrLink() { return { kind: "PRIVILEGED_ACCOUNT_CONFLICT" }; },
      async completeOnboarding() { return { kind: "IDENTITY_CONFLICT" }; },
    };
    await assert.rejects(
      authenticateGoogleStudent({ credential: "signed-google-id-token", clientId, hostedDomain, verifier: verifier(), store, now }),
      (error) => error instanceof GoogleStudentAuthError && error.code === "PRIVILEGED_ACCOUNT_CONFLICT",
    );
  });

  it("requires onboarding for a first-time Student", async () => {
    const store: GoogleStudentIdentityStore = {
      async resolveOrLink() { return { kind: "ONBOARDING_REQUIRED" }; },
      async completeOnboarding() { return { kind: "IDENTITY_CONFLICT" }; },
    };
    const result = await authenticateGoogleStudent({ credential: "signed-google-id-token", clientId, hostedDomain, verifier: verifier(), store, now });
    assert.equal(result.kind, "ONBOARDING_REQUIRED");
    if (result.kind === "ONBOARDING_REQUIRED") {
      assert.equal(result.identity.providerSubject, validClaims.sub);
    }
  });

  it("never lets browser-supplied email override verified token claims", async () => {
    let observedEmail = "";
    const store: GoogleStudentIdentityStore = {
      async resolveOrLink(identity) { observedEmail = identity.email; return { kind: "ONBOARDING_REQUIRED" }; },
      async completeOnboarding() { return { kind: "IDENTITY_CONFLICT" }; },
    };
    await authenticateGoogleStudent({
      credential: "signed-google-id-token",
      clientId,
      hostedDomain,
      verifier: verifier(),
      store,
      now,
      ...({ email: "attacker@gmail.com" } as Record<string, string>),
    });
    assert.equal(observedEmail, student.email);
  });

  it("creates the Student and external identity through one completion port", async () => {
    let captured: Parameters<GoogleStudentIdentityStore["completeOnboarding"]>[0] | undefined;
    const store: GoogleStudentIdentityStore = {
      async resolveOrLink() { return { kind: "ONBOARDING_REQUIRED" }; },
      async completeOnboarding(input) { captured = input; return { kind: "CREATED", user: student }; },
    };
    const user = await completeGoogleStudentOnboarding({
      identity: validateGoogleStudentClaims({ claims: validClaims, clientId, hostedDomain, now }),
      name: "Student One",
      studentId: "24WAB09999",
      initialCredit: 100,
      store,
      now,
    });
    assert.equal(user.role, "STUDENT");
    assert.equal(captured?.identity.providerSubject, validClaims.sub);
    assert.equal(captured?.initialCredit, 100);
  });

  it("does not allow the same onboarding identity to complete twice", async () => {
    let completed = false;
    const store: GoogleStudentIdentityStore = {
      async resolveOrLink() { return { kind: "ONBOARDING_REQUIRED" }; },
      async completeOnboarding() {
        if (completed) return { kind: "ONBOARDING_STATE_USED" };
        completed = true;
        return { kind: "CREATED", user: student };
      },
    };
    const input = {
      identity: validateGoogleStudentClaims({ claims: validClaims, clientId, hostedDomain, now }),
      name: "Student One",
      studentId: "24WAB09999",
      initialCredit: 100,
      store,
      now,
    };
    assert.equal((await completeGoogleStudentOnboarding(input)).id, student.id);
    await assert.rejects(
      completeGoogleStudentOnboarding(input),
      (error) =>
        error instanceof GoogleStudentAuthError &&
        error.code === "ONBOARDING_STATE_USED",
    );
  });

  for (const conflict of ["STUDENT_ID_CONFLICT", "IDENTITY_CONFLICT", "ONBOARDING_STATE_USED"] as const) {
    it(`maps ${conflict} to a safe application error`, async () => {
      const store: GoogleStudentIdentityStore = {
        async resolveOrLink() { return { kind: "ONBOARDING_REQUIRED" }; },
        async completeOnboarding() { return { kind: conflict }; },
      };
      await assert.rejects(
        completeGoogleStudentOnboarding({
          identity: validateGoogleStudentClaims({ claims: validClaims, clientId, hostedDomain, now }),
          name: "Student One",
          studentId: "24WAB09999",
          initialCredit: 100,
          store,
          now,
        }),
        (error) => error instanceof GoogleStudentAuthError && error.code === conflict,
      );
    });
  }
});
