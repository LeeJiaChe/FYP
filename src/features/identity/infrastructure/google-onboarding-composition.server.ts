import "server-only";

import { serverEnvironment } from "@/shared/config/env.server";
import { productPolicy } from "@/shared/config/policies";
import type { VerifiedGoogleStudentIdentity } from "../domain/google-student-identity";
import {
  clearedGoogleOnboardingCookieOptions as clearedOptions,
  createGoogleOnboardingState as createState,
  GOOGLE_ONBOARDING_COOKIE,
  googleOnboardingCookieOptions as cookieOptions,
  verifyGoogleOnboardingState as verifyState,
} from "./google-onboarding-state.server";

const configuration = {
  signingSecret: serverEnvironment.session.signingSecret,
  runtime: serverEnvironment.runtime,
  hostedDomain: serverEnvironment.googleStudent.hostedDomain,
  ttlMs: productPolicy.googleOnboardingTtlMs,
} as const;

export { GOOGLE_ONBOARDING_COOKIE };

export function googleOnboardingCookieOptions() {
  return cookieOptions(configuration);
}

export function createGoogleOnboardingState(
  identity: VerifiedGoogleStudentIdentity,
) {
  return createState(identity, configuration);
}

export function verifyGoogleOnboardingState(token: string | undefined) {
  return verifyState(token, configuration);
}

export function clearedGoogleOnboardingCookieOptions() {
  return clearedOptions(configuration);
}
