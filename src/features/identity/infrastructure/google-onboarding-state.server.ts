import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

import type { VerifiedGoogleStudentIdentity } from "../domain/google-student-identity";

export const GOOGLE_ONBOARDING_COOKIE = "fyp_google_student_onboarding";
const ONBOARDING_ISSUER = "fyp-bus-system";
const ONBOARDING_AUDIENCE = "google-student-onboarding";
const ONBOARDING_PURPOSE = "COMPLETE_GOOGLE_STUDENT";
const ONBOARDING_KEY_CONTEXT = "fyp-google-student-onboarding-v1";

interface OnboardingPayload extends jwt.JwtPayload {
  purpose: typeof ONBOARDING_PURPOSE;
  providerSubject: string;
  email: string;
  name: string;
  hostedDomain: string;
}

export interface GoogleOnboardingConfiguration {
  readonly signingSecret: string;
  readonly runtime: "development" | "test" | "production";
  readonly hostedDomain: string;
  readonly ttlMs: number;
}

function onboardingSigningKey(configuration: GoogleOnboardingConfiguration) {
  return createHmac("sha256", configuration.signingSecret)
    .update(ONBOARDING_KEY_CONTEXT, "utf8")
    .digest();
}

export function googleOnboardingCookieOptions(
  configuration: GoogleOnboardingConfiguration,
) {
  return {
    httpOnly: true as const,
    secure: configuration.runtime === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(configuration.ttlMs / 1_000),
  };
}

export function createGoogleOnboardingState(
  identity: VerifiedGoogleStudentIdentity,
  configuration: GoogleOnboardingConfiguration,
  now: Date = new Date(),
): string {
  return jwt.sign(
    {
      purpose: ONBOARDING_PURPOSE,
      providerSubject: identity.providerSubject,
      email: identity.email,
      name: identity.name,
      hostedDomain: identity.hostedDomain,
      iat: Math.floor(now.getTime() / 1_000),
    } satisfies Omit<OnboardingPayload, keyof jwt.JwtPayload>,
    onboardingSigningKey(configuration),
    {
      audience: ONBOARDING_AUDIENCE,
      issuer: ONBOARDING_ISSUER,
      expiresIn: Math.floor(configuration.ttlMs / 1_000),
      jwtid: randomUUID(),
    },
  );
}

export function verifyGoogleOnboardingState(
  token: string | undefined,
  configuration: GoogleOnboardingConfiguration,
  now: Date = new Date(),
): VerifiedGoogleStudentIdentity | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, onboardingSigningKey(configuration), {
      audience: ONBOARDING_AUDIENCE,
      issuer: ONBOARDING_ISSUER,
      clockTimestamp: Math.floor(now.getTime() / 1_000),
    }) as OnboardingPayload;
    if (
      payload.purpose !== ONBOARDING_PURPOSE ||
      typeof payload.providerSubject !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.hostedDomain !== "string"
    ) {
      return null;
    }
    const configuredDomain = configuration.hostedDomain;
    const emailDomain = payload.email.toLowerCase().split("@").at(-1);
    if (
      payload.hostedDomain.toLowerCase() !== configuredDomain ||
      emailDomain !== configuredDomain
    ) {
      return null;
    }
    return {
      provider: "GOOGLE",
      providerSubject: payload.providerSubject,
      email: payload.email.toLowerCase(),
      name: payload.name,
      hostedDomain: configuredDomain,
    };
  } catch {
    return null;
  }
}

export function clearedGoogleOnboardingCookieOptions(
  configuration: GoogleOnboardingConfiguration,
) {
  return {
    ...googleOnboardingCookieOptions(configuration),
    maxAge: 0,
    expires: new Date(0),
  };
}
