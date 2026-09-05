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

export async function authenticateWithPassword(input: {
  identifier: string;
  password: string;
  demoStudentPasswordLoginEnabled: boolean;
  store: PasswordLoginStore;
  verifyPassword: (password: string, hash: string | null) => Promise<boolean>;
}): Promise<PasswordLoginUser> {
  const user = await input.store.findByIdentifier(input.identifier);
  if (!user) throw new PasswordLoginError("INVALID_CREDENTIALS");

  if (user.role === "STUDENT" && !input.demoStudentPasswordLoginEnabled) {
    throw new PasswordLoginError("USE_GOOGLE");
  }
  if (
    user.role === "STUDENT" &&
    user.studentIdentityAssurance !== "LEGACY_PROTOTYPE" &&
    user.studentIdentityAssurance !== "EMAIL_VERIFIED"
  ) {
    throw new PasswordLoginError("USE_GOOGLE");
  }
  if (!(await input.verifyPassword(input.password, user.passwordHash))) {
    throw new PasswordLoginError("INVALID_CREDENTIALS");
  }
  return user;
}
