import { isKnownFixturePassword } from "@/shared/validation/staff-password";
import type { StudentIdentityAssurance } from "../domain/email-verification";

export interface PasswordLoginUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: "STUDENT" | "DRIVER" | "ADMIN";
  readonly studentId: string | null;
  readonly creditScore: number;
  readonly sessionVersion: number;
  readonly passwordHash: string | null;
  readonly emailVerifiedAt: Date | null;
  readonly studentIdentityAssurance: StudentIdentityAssurance | null;
}

export interface PasswordLoginStore {
  findByIdentifier(identifier: string): Promise<PasswordLoginUser | null>;
}

export class PasswordLoginError extends Error {
  constructor(readonly code: "INVALID_CREDENTIALS" | "USE_GOOGLE") {
    super(
      code === "USE_GOOGLE"
        ? "Students must continue with their TAR UMT Google account."
        : "Invalid credentials",
    );
    this.name = "PasswordLoginError";
  }
}

// A bcrypt hash with standard work factor used only to equalize rejected lookups.
const DUMMY_PASSWORD_HASH = "$2b$10$wG2LEbf7a4z6hI3Kozx6Duokxf7UFSvhvAkp/eVgR3R62hCJfto3y";

export async function authenticateWithPassword(input: {
  identifier: string;
  password: string;
  demoStudentPasswordLoginEnabled: boolean;
  store: PasswordLoginStore;
  verifyPassword: (password: string, hash: string | null) => Promise<boolean>;
}): Promise<PasswordLoginUser> {
  const user = await input.store.findByIdentifier(input.identifier);
  const studentRequiresGoogle = user?.role === "STUDENT" && (
    !input.demoStudentPasswordLoginEnabled ||
    (user.studentIdentityAssurance !== "LEGACY_PROTOTYPE" && user.studentIdentityAssurance !== "EMAIL_VERIFIED")
  );
  const fixturePasswordRejected = !input.demoStudentPasswordLoginEnabled && isKnownFixturePassword(input.password);
  const eligibleHash = studentRequiresGoogle || fixturePasswordRejected ? null : user?.passwordHash;
  const verified = await input.verifyPassword(input.password, eligibleHash ?? DUMMY_PASSWORD_HASH);

  if (studentRequiresGoogle) throw new PasswordLoginError("USE_GOOGLE");
  if (!user || !eligibleHash || !verified) throw new PasswordLoginError("INVALID_CREDENTIALS");
  return user;
}
