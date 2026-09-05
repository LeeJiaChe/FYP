import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authenticateWithPassword,
  PasswordLoginError,
  type PasswordLoginStore,
  type PasswordLoginUser,
} from "@/features/identity/application/password-login";
import { verifyPassword } from "@/lib/auth";

function user(overrides: Partial<PasswordLoginUser>): PasswordLoginUser {
  return {
    id: "user-id",
    name: "Demo User",
    email: "user@example.test",
    role: "DRIVER",
    studentId: null,
    creditScore: 100,
    sessionVersion: 1,
    passwordHash: "stored-hash",
    emailVerifiedAt: new Date("2026-09-05T00:00:00Z"),
    studentIdentityAssurance: null,
    ...overrides,
  };
}

function store(record: PasswordLoginUser | null): PasswordLoginStore {
  return { async findByIdentifier() { return record; } };
}

const matches = async (_password: string, hash: string | null) => hash === "stored-hash";

describe("role-specific password login", () => {
  for (const role of ["DRIVER", "ADMIN"] as const) {
    it(`keeps ${role} password login available`, async () => {
      const result = await authenticateWithPassword({
        identifier: `${role.toLowerCase()}@example.test`,
        password: "Password123",
        demoStudentPasswordLoginEnabled: false,
        store: store(user({ role })),
        verifyPassword: matches,
      });
      assert.equal(result.role, role);
    });
  }

  it("rejects Student password login when the demo server gate is disabled", async () => {
    await assert.rejects(
      authenticateWithPassword({
        identifier: "student1@student.tarc.edu.my",
        password: "password123",
        demoStudentPasswordLoginEnabled: false,
        store: store(user({ role: "STUDENT", studentIdentityAssurance: "LEGACY_PROTOTYPE" })),
        verifyPassword: matches,
      }),
      (error) => error instanceof PasswordLoginError && error.code === "USE_GOOGLE",
    );
  });

  it("keeps an explicit LEGACY_PROTOTYPE demo Student usable when enabled", async () => {
    const result = await authenticateWithPassword({
      identifier: "24WAB01234",
      password: "password123",
      demoStudentPasswordLoginEnabled: true,
      store: store(user({ role: "STUDENT", studentIdentityAssurance: "LEGACY_PROTOTYPE" })),
      verifyPassword: matches,
    });
    assert.equal(result.role, "STUDENT");
  });

  it("does not allow a Google-only Student through the password fallback", async () => {
    await assert.rejects(
      authenticateWithPassword({
        identifier: "student@student.tarc.edu.my",
        password: "Password123",
        demoStudentPasswordLoginEnabled: true,
        store: store(user({ role: "STUDENT", passwordHash: null, studentIdentityAssurance: "GOOGLE_WORKSPACE_VERIFIED" })),
        verifyPassword: matches,
      }),
      (error) => error instanceof PasswordLoginError && error.code === "USE_GOOGLE",
    );
  });

  it("handles nullable credentials safely for Student and staff records", async () => {
    assert.equal(await verifyPassword("Password123", null), false);
    await assert.rejects(
      authenticateWithPassword({
        identifier: "driver@example.test",
        password: "Password123",
        demoStudentPasswordLoginEnabled: false,
        store: store(user({ role: "DRIVER", passwordHash: null })),
        verifyPassword: matches,
      }),
      (error) => error instanceof PasswordLoginError && error.code === "INVALID_CREDENTIALS",
    );
  });
});
