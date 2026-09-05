import "server-only";

import { verifyPassword } from "@/lib/auth";
import { serverEnvironment } from "@/shared/config/env.server";
import { productPolicy } from "@/shared/config/policies";
import {
  authenticateGoogleStudent,
  completeGoogleStudentOnboarding,
  GoogleStudentAuthError,
} from "./application/google-student-auth";
import {
  authenticateWithPassword,
  PasswordLoginError,
} from "./application/password-login";
import {
  registerStudent as registerLegacyStudent,
  resendStudentVerification,
  StudentRegistrationError,
  verifyStudentEmail,
} from "./application/register-student";
import {
  requestStaffPasswordReset as requestStaffPasswordResetUseCase,
  resetStaffPassword as resetStaffPasswordUseCase,
  StaffPasswordResetError,
} from "./application/staff-password-reset";
import { googleStudentIdentityStore } from "./infrastructure/google-identity.prisma.server";
import {
  createGoogleOnboardingState,
  GOOGLE_ONBOARDING_COOKIE,
  googleOnboardingCookieOptions,
  clearedGoogleOnboardingCookieOptions,
  verifyGoogleOnboardingState,
} from "./infrastructure/google-onboarding-composition.server";
import { googleCredentialVerifier } from "./infrastructure/google-token-verifier.server";
import { passwordLoginStore } from "./infrastructure/password-login.prisma.server";
import { staffPasswordResetStore } from "./infrastructure/staff-password-reset.prisma.server";
import { getTransactionalEmailDelivery } from "./infrastructure/transactional-email-composition.server";

export {
  GOOGLE_ONBOARDING_COOKIE,
  GoogleStudentAuthError,
  PasswordLoginError,
  StaffPasswordResetError,
  StudentRegistrationError,
  clearedGoogleOnboardingCookieOptions,
  googleOnboardingCookieOptions,
  resendStudentVerification,
  verifyStudentEmail,
};

export {
  completeGoogleStudentSchema,
  googleStudentCredentialSchema,
} from "./contracts/google-student.schemas";
export {
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./contracts/password-reset.schemas";

export async function registerStudent(input: {
  name: string;
  email: string;
  studentId: string;
  password: string;
}) {
  if (!serverEnvironment.demoAuth.studentPasswordLoginEnabled) {
    throw new StudentRegistrationError(
      "REGISTRATION_DISABLED",
      "Student password registration is disabled. Continue with TAR UMT Google.",
    );
  }
  return registerLegacyStudent(input);
}

export function googleStudentConfiguration() {
  return {
    clientId: serverEnvironment.googleStudent.clientId,
    hostedDomain: serverEnvironment.googleStudent.hostedDomain,
    configured: serverEnvironment.googleStudent.configured,
  };
}

export async function loginWithPassword(input: {
  identifier: string;
  password: string;
}) {
  return authenticateWithPassword({
    ...input,
    demoStudentPasswordLoginEnabled:
      serverEnvironment.demoAuth.studentPasswordLoginEnabled,
    store: passwordLoginStore,
    verifyPassword,
  });
}

export async function loginGoogleStudent(credential: string) {
  return authenticateGoogleStudent({
    credential,
    clientId: serverEnvironment.googleStudent.clientId,
    hostedDomain: serverEnvironment.googleStudent.hostedDomain,
    verifier: googleCredentialVerifier,
    store: googleStudentIdentityStore,
  });
}

export function createStudentOnboardingState(input: Parameters<
  typeof createGoogleOnboardingState
>[0]) {
  return createGoogleOnboardingState(input);
}

export async function completeStudentOnboarding(input: {
  onboardingState: string | undefined;
  name: string;
  studentId: string;
}) {
  const identity = verifyGoogleOnboardingState(input.onboardingState);
  if (!identity) {
    throw new GoogleStudentAuthError(
      "ONBOARDING_STATE_INVALID",
      "Student onboarding has expired. Continue with Google again.",
    );
  }
  return completeGoogleStudentOnboarding({
    identity,
    name: input.name,
    studentId: input.studentId,
    initialCredit: productPolicy.initialCredit,
    store: googleStudentIdentityStore,
  });
}

export function readStudentOnboardingProfile(onboardingState: string | undefined) {
  const identity = verifyGoogleOnboardingState(onboardingState);
  return identity ? { email: identity.email, name: identity.name } : null;
}

export async function requestStaffPasswordReset(email: string) {
  return requestStaffPasswordResetUseCase({
    email,
    store: staffPasswordResetStore,
    delivery: getTransactionalEmailDelivery(),
  });
}

export async function resetStaffPassword(input: {
  token: string;
  password: string;
}) {
  return resetStaffPasswordUseCase({
    rawToken: input.token,
    password: input.password,
    store: staffPasswordResetStore,
  });
}

export { createDriverSchema, updateDriverSchema } from "./contracts/driver.schemas";
export { createDriver, listDrivers, updateDriver } from "./application/manage-drivers";
