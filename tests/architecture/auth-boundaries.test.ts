import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const workspace = path.resolve(import.meta.dirname, "../..");
const source = (file: string) => readFile(path.join(workspace, file), "utf8");

describe("institutional authentication architecture", () => {
  it("keeps Google verification and Resend in server-only modules", async () => {
    const verifier = await source("src/features/identity/infrastructure/google-token-verifier.server.ts");
    const email = await source("src/features/identity/infrastructure/transactional-email.server.ts");
    const googleUi = await source("src/features/identity/ui/GoogleStudentButton.tsx");
    assert.match(verifier, /import "server-only"/);
    assert.match(verifier, /from "google-auth-library"/);
    assert.match(email, /import "server-only"/);
    assert.match(email, /from "resend"/);
    assert.doesNotMatch(googleUi, /google-auth-library|\bresend\b|RESEND_API_KEY/);
  });

  it("never exposes the Resend key or persists a raw Google credential", async () => {
    const environment = await source("src/shared/config/server-environment.ts");
    const schema = await source("prisma/schema.prisma");
    assert.match(environment, /RESEND_API_KEY/);
    assert.doesNotMatch(environment, /NEXT_PUBLIC_RESEND/);
    assert.doesNotMatch(schema, /googleToken|idToken|accessToken|refreshToken/);
    assert.match(schema, /providerSubject/);
  });

  it("gates all three Quick Login buttons behind the public demo flag", async () => {
    const login = await source("app/login/page.tsx");
    assert.match(login, /NEXT_PUBLIC_DEMO_MODE/);
    assert.match(login, /NODE_ENV !== "production"/);
    assert.match(login, /demoMode &&/);
    for (const label of ["Student 1", "Driver 1", "Admin Staff"]) {
      assert.match(login, new RegExp(label));
    }
    assert.doesNotMatch(login, /Student\/driver password:/);
  });

  it("preserves usable seed fixtures without fake Google identities", async () => {
    const seed = await source("prisma/seed.ts");
    assert.match(seed, /student1@student\.tarc\.edu\.my/);
    assert.match(seed, /driver1@tarumt\.edu\.my/);
    assert.match(seed, /admin1@admin\.tarc\.edu\.my/);
    assert.match(seed, /studentIdentityAssurance: "LEGACY_PROTOTYPE"/);
    assert.doesNotMatch(seed, /externalAuthIdentity/);
  });

  it("keeps Google and reset route handlers as transport adapters", async () => {
    for (const file of [
      "app/api/auth/google/student/route.ts",
      "app/api/auth/google/student/complete/route.ts",
      "app/api/auth/forgot-password/route.ts",
      "app/api/auth/reset-password/route.ts",
    ]) {
      const route = await source(file);
      assert.match(route, /@\/features\/identity\/server/);
      assert.doesNotMatch(route, /@\/lib\/prisma|@\/shared\/db|\bprisma\./);
    }
  });

  it("enforces identity and reset concurrency invariants in persistence", async () => {
    const schema = await source("prisma/schema.prisma");
    const googleStore = await source(
      "src/features/identity/infrastructure/google-identity.prisma.server.ts",
    );
    const resetStore = await source(
      "src/features/identity/infrastructure/staff-password-reset.prisma.server.ts",
    );
    assert.match(schema, /studentId\s+String\?\s+@unique/);
    assert.match(schema, /@@unique\(\[provider, providerSubject\]\)/);
    assert.match(schema, /@@unique\(\[userId, provider\]\)/);
    assert.match(googleStore, /TransactionIsolationLevel\.Serializable/);
    assert.match(resetStore, /sessionVersion: \{ increment: 1 \}/);
    assert.match(resetStore, /consumedAt: null/);
  });
});
