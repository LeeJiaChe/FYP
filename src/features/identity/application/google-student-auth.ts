import {
  GoogleIdentityClaimsError,
  type GoogleIdTokenClaims,
  type VerifiedGoogleStudentIdentity,
  validateGoogleStudentClaims,
} from "../domain/google-student-identity";

export interface GoogleCredentialVerifier {
  verifyIdToken(input: {
    credential: string;
    audience: string;
  }): Promise<GoogleIdTokenClaims>;
}

export interface StudentSessionIdentity {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: "STUDENT";
  readonly studentId: string | null;
  readonly creditScore: number;
  readonly sessionVersion: number;
}

export interface GoogleStudentIdentityStore {
  resolveOrLink(
    identity: VerifiedGoogleStudentIdentity,
    now: Date,
  ): Promise<
    | { readonly kind: "AUTHENTICATED"; readonly user: StudentSessionIdentity }
    | { readonly kind: "ONBOARDING_REQUIRED" }
    | {
        readonly kind:
          | "PRIVILEGED_ACCOUNT_CONFLICT"
          | "EMAIL_CONFLICT"
          | "IDENTITY_CONFLICT";
      }
  >;
  completeOnboarding(input: {
    identity: VerifiedGoogleStudentIdentity;
    name: string;
    studentId: string;
    initialCredit: number;
    now: Date;
  }): Promise<
    | { readonly kind: "CREATED"; readonly user: StudentSessionIdentity }
    | {
        readonly kind:
          | "EMAIL_CONFLICT"
          | "IDENTITY_CONFLICT"
          | "STUDENT_ID_CONFLICT"
          | "ONBOARDING_STATE_USED";
      }
  >;
}

export type GoogleStudentAuthErrorCode =
  | "UNAVAILABLE"
  | "INVALID_GOOGLE_IDENTITY"
  | "INSTITUTIONAL_ACCOUNT_REQUIRED"
  | "PRIVILEGED_ACCOUNT_CONFLICT"
  | "EMAIL_CONFLICT"
  | "IDENTITY_CONFLICT"
  | "STUDENT_ID_CONFLICT"
  | "ONBOARDING_STATE_INVALID"
  | "ONBOARDING_STATE_USED";

export class GoogleStudentAuthError extends Error {
  constructor(
    readonly code: GoogleStudentAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GoogleStudentAuthError";
  }
}

export async function verifyGoogleStudentCredential(input: {
  credential: string;
  clientId: string;
  hostedDomain: string;
  verifier: GoogleCredentialVerifier;
  now?: Date;
}): Promise<VerifiedGoogleStudentIdentity> {
  if (!input.clientId) {
    throw new GoogleStudentAuthError(
      "UNAVAILABLE",
      "Google Student sign-in is not configured",
    );
  }

  try {
    const claims = await input.verifier.verifyIdToken({
      credential: input.credential,
      audience: input.clientId,
    });
    return validateGoogleStudentClaims({
      claims,
      clientId: input.clientId,
      hostedDomain: input.hostedDomain,
      now: input.now ?? new Date(),
    });
  } catch (error) {
    if (
      error instanceof GoogleIdentityClaimsError &&
      (error.code === "EMAIL_DOMAIN_NOT_ALLOWED" ||
        error.code === "HOSTED_DOMAIN_MISSING" ||
        error.code === "HOSTED_DOMAIN_NOT_ALLOWED")
    ) {
      throw new GoogleStudentAuthError(
        "INSTITUTIONAL_ACCOUNT_REQUIRED",
        "Please sign in with your TAR UMT student Google account.",
      );
    }
    if (error instanceof GoogleStudentAuthError) throw error;
    throw new GoogleStudentAuthError(
      "INVALID_GOOGLE_IDENTITY",
      "Google sign-in could not be verified. Please try again.",
    );
  }
}

export async function authenticateGoogleStudent(input: {
  credential: string;
  clientId: string;
  hostedDomain: string;
  verifier: GoogleCredentialVerifier;
  store: GoogleStudentIdentityStore;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const identity = await verifyGoogleStudentCredential({ ...input, now });
  const result = await input.store.resolveOrLink(identity, now);
  if (result.kind === "AUTHENTICATED") return result;
  if (result.kind === "ONBOARDING_REQUIRED") {
    return { kind: "ONBOARDING_REQUIRED" as const, identity };
  }
  if (result.kind === "PRIVILEGED_ACCOUNT_CONFLICT") {
    throw new GoogleStudentAuthError(
      result.kind,
      "This institutional email cannot be linked to a Student account.",
    );
  }
  throw new GoogleStudentAuthError(
    result.kind,
    "Google Student sign-in could not be linked safely.",
  );
}

export async function completeGoogleStudentOnboarding(input: {
  identity: VerifiedGoogleStudentIdentity;
  name: string;
  studentId: string;
  initialCredit: number;
  store: GoogleStudentIdentityStore;
  now?: Date;
}) {
  const result = await input.store.completeOnboarding({
    identity: input.identity,
    name: input.name,
    studentId: input.studentId,
    initialCredit: input.initialCredit,
    now: input.now ?? new Date(),
  });
  if (result.kind === "CREATED") return result.user;
  const message =
    result.kind === "STUDENT_ID_CONFLICT"
      ? "This Student ID is already in use."
      : result.kind === "ONBOARDING_STATE_USED"
        ? "This onboarding session has already been completed."
        : "Student account completion conflicts with an existing identity.";
  throw new GoogleStudentAuthError(result.kind, message);
}
