import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

import { UPGRADE_DATABASE } from "../src/shared/db/disposable-fixture";
import { runFixtureCommand, withDisposablePostgres } from "./disposable-postgres";
import { verifyTestDatabaseEnvironment } from "./verify-test-database";

const prismaCli = "node_modules/prisma/build/index.js";
const history = 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL';
const protection = `SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
  AND relname IN ('EmailVerificationToken', 'PasswordResetToken', 'ExternalAuthIdentity') AND relrowsecurity`;
const preserved = `SELECT jsonb_build_object(
  'users', (SELECT jsonb_agg(to_jsonb(u)-'emailVerifiedAt'-'studentIdentityAssurance' ORDER BY id) FROM "User" u),
  'notice', (SELECT jsonb_agg(to_jsonb(n)-'contextPath' ORDER BY id) FROM "Notification" n),
  'trip', (SELECT jsonb_agg(t ORDER BY id) FROM "Trip" t),
  'stops', (SELECT jsonb_agg(s ORDER BY id) FROM "TripStop" s),
  'segments', (SELECT jsonb_agg(s ORDER BY id) FROM "TripSegment" s),
  'booking', (SELECT jsonb_agg(b ORDER BY id) FROM "Booking" b),
  'waitlist', (SELECT jsonb_agg(w ORDER BY id) FROM "WaitlistEntry" w),
  'penalty', (SELECT jsonb_agg(p ORDER BY id) FROM "Penalty" p),
  'appeal', (SELECT jsonb_agg(a ORDER BY id) FROM "PenaltyAppeal" a),
  'routes', (SELECT jsonb_agg(r ORDER BY id) FROM "Route" r),
  'buses', (SELECT jsonb_agg(b ORDER BY id) FROM "Bus" b)
)`;
const migrations = readdirSync("prisma/migrations", { withFileTypes: true })
  .filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();

function compareSchema(environment: NodeJS.ProcessEnv, expectedExit: number) {
  const diff = spawnSync(process.execPath, [prismaCli, "migrate", "diff",
    "--from-schema-datasource", "prisma/schema.prisma", "--to-schema-datamodel",
    "prisma/schema.prisma", "--exit-code"], { env: environment, encoding: "utf8" });
  if (diff.status !== expectedExit) console.error(diff.stdout, diff.stderr.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[database URL]"));
  assert.equal(diff.status, expectedExit, "Unexpected Prisma schema comparison exit code");
  return diff.stdout;
}

async function checkUpgradeRuntime() {
  await verifyTestDatabaseEnvironment(process.env, UPGRADE_DATABASE);
  const { prisma } = await import("../src/shared/db/prisma.server");
  const { authenticateWithPassword } = await import("../src/features/identity/application/password-login");
  const { passwordLoginStore } = await import("../src/features/identity/infrastructure/password-login.prisma.server");
  const { staffPasswordResetStore } = await import("../src/features/identity/infrastructure/staff-password-reset.prisma.server");
  const { canStudentIdentityAuthenticate } = await import("../src/features/identity/domain/email-verification");
  try {
    const staff = await authenticateWithPassword({
      identifier: "driver@example.test", password: "synthetic",
      demoStudentPasswordLoginEnabled: false, store: passwordLoginStore,
      verifyPassword: async (_, hash) => hash === "fixture-driver",
    });
    assert.equal(staff.sessionVersion, 5);
    const student = await prisma.user.findUniqueOrThrow({ where: { id: "upgrade-student" } });
    assert.equal(student.sessionVersion, 4);
    assert.equal(canStudentIdentityAuthenticate({ assurance: student.studentIdentityAssurance,
      emailVerifiedAt: student.emailVerifiedAt, demoPasswordLoginEnabled: false }), false);
    assert.equal(canStudentIdentityAuthenticate({ assurance: student.studentIdentityAssurance,
      emailVerifiedAt: student.emailVerifiedAt, demoPasswordLoginEnabled: true }), true);
    const google = await prisma.user.create({ data: {
      name: "Synthetic Workspace Student", email: "google@student.tarc.edu.my", role: "STUDENT",
      studentIdentityAssurance: "GOOGLE_WORKSPACE_VERIFIED", emailVerifiedAt: new Date(),
      externalAuthIdentities: { create: { provider: "GOOGLE", providerSubject: "upgrade-synthetic-subject",
        emailAtLink: "google@student.tarc.edu.my" } },
    } });
    assert.equal(google.passwordHash, null);
    await assert.rejects(prisma.externalAuthIdentity.create({ data: {
      userId: student.id, provider: "GOOGLE", providerSubject: "upgrade-synthetic-subject", emailAtLink: student.email,
    } }), { code: "P2002" });
    const token = { email: staff.email, now: new Date(), expiresAt: new Date(Date.now() + 60_000), tokenHash: "a".repeat(64) };
    assert.ok(await staffPasswordResetStore.createIfEligible(token));
    assert.equal(await staffPasswordResetStore.createIfEligible({ ...token, email: student.email }), null);
    const verification = { userId: student.id, tokenHash: "b".repeat(64), expiresAt: token.expiresAt };
    await prisma.emailVerificationToken.create({ data: verification });
    await assert.rejects(prisma.emailVerificationToken.create({ data: verification }), { code: "P2002" });
    console.log("Upgrade runtime assertions passed for staff login, session assurance, Google identity and token uniqueness.");
  } finally {
    await prisma.$disconnect();
  }
}

async function rehearse() {
  await withDisposablePostgres(async ({ environment, sql }) => {
    assert.equal(migrations.length, 9);
    const clean = environment();
    await verifyTestDatabaseEnvironment(clean);
    runFixtureCommand(process.execPath, [prismaCli, "migrate", "deploy"], clean);
    runFixtureCommand(process.execPath, [prismaCli, "migrate", "status"], clean);
    runFixtureCommand(process.execPath, [prismaCli, "validate"], clean);
    const cleanDiff = compareSchema(clean, 2);
    assert.match(cleanDiff, /Booking_boarding_stop_same_trip_fkey/);
    assert.match(cleanDiff, /TripLocationSample/);
    assert.match(cleanDiff, /Removed foreign key on columns \(tripId, fromTripStopId\)/);
    assert.doesNotMatch(cleanDiff, /assigned_driver_id|defaultDriverId/);
    runFixtureCommand(process.execPath, ["--import", "tsx", "prisma/seed.ts"], clean);
    assert.equal(sql('SELECT count(*) FROM "Route"'), "10");
    assert.equal(sql('SELECT count(*) FROM "Trip"'), "13");
    assert.equal(sql(protection), "3");
    assert.equal(sql(history), "9");
    console.log("Clean installation: 9 migrations, documented schema representation differences, 10 Routes, 13 Trips, 3 identity tables with RLS.");

    const upgrade = environment(UPGRADE_DATABASE);
    await verifyTestDatabaseEnvironment(upgrade, UPGRADE_DATABASE);
    const staging = mkdtempSync("/tmp/fyp-migration-stage-");
    try {
      mkdirSync(path.join(staging, "migrations"));
      cpSync("prisma/schema.prisma", path.join(staging, "schema.prisma"));
      cpSync("prisma/migrations/migration_lock.toml", path.join(staging, "migrations", "migration_lock.toml"));
      for (const name of migrations.slice(0, 7)) {
        cpSync(path.join("prisma/migrations", name), path.join(staging, "migrations", name), { recursive: true });
      }
      runFixtureCommand(process.execPath, [prismaCli, "migrate", "deploy", "--schema", path.join(staging, "schema.prisma")], upgrade);
    } finally {
      rmSync(staging, { recursive: true, force: true });
    }
    const query = (sqlText: string) => sql(sqlText, UPGRADE_DATABASE);
    assert.equal(query(history), "7");
    query(readFileSync("tests/fixtures/seven-migration-upgrade.sql", "utf8"));
    const before = query(preserved);
    // Deliberately fail late in the first pending migration on this disposable target.
    query('CREATE TABLE "PasswordResetToken" (fixture_conflict integer)');
    const forcedFailure = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      env: upgrade, encoding: "utf8",
    });
    assert.equal(forcedFailure.status, 1);
    assert.match(forcedFailure.stderr, /P3018/);
    assert.equal(query(preserved), before);
    assert.equal(query(history), "7");
    assert.equal(query(`SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'emailVerifiedAt'`), "0");
    query('DROP TABLE "PasswordResetToken"');
    runFixtureCommand(process.execPath, [prismaCli, "migrate", "resolve", "--rolled-back", migrations[7]!], upgrade);
    console.log("Synthetic late DDL conflict rolled back without modifying baseline data. Recovered the local migration history.");
    runFixtureCommand(process.execPath, [prismaCli, "migrate", "deploy"], upgrade);
    assert.equal(query(preserved), before);
    assert.equal(query(history), "9");
    assert.equal(query(protection), "3");
    assert.equal(query(`SELECT count(*) FROM "User" WHERE
      (role = 'STUDENT' AND "studentIdentityAssurance" = 'LEGACY_PROTOTYPE' AND "emailVerifiedAt" IS NULL)
      OR (role IN ('DRIVER','ADMIN') AND "emailVerifiedAt" = "createdAt")`), "3");
    const drift = compareSchema(upgrade, 2);
    assert.match(drift, /assigned_driver_id/);
    assert.match(drift, /defaultDriverId/);
    const withoutLegacy = drift.trim().split("\n\n")
      .filter((section) => !section.includes('Changed the `Bus` table'))
      .map((section) => section.split("\n").filter((line) => !line.includes("defaultDriverId")).join("\n"))
      .join("\n\n");
    assert.equal(withoutLegacy.trim(), cleanDiff.trim());
    runFixtureCommand(process.execPath, [prismaCli, "migrate", "deploy"], upgrade);
    assert.equal(query(preserved), before);
    assert.equal(query(history), "9");
    runFixtureCommand(process.execPath, [prismaCli, "migrate", "status"], upgrade);

    // Rehearsal-only preservation proposal. Shared DDL requires separate approval.
    query('ALTER TABLE "Route" ALTER COLUMN "defaultDriverId" DROP NOT NULL');
    assert.equal(query(preserved), before);
    assert.equal(compareSchema(upgrade, 2), drift);
    runFixtureCommand(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/rehearse-migrations.ts", "--check-upgrade-runtime"], upgrade);
    query(`INSERT INTO "Route" (id,name,"lineId",direction,"updatedAt")
      SELECT 'upgrade-new-route','Synthetic New Route',id,'INBOUND',now() FROM "ServiceLine" ORDER BY id LIMIT 1`);
    assert.equal(query(`CREATE ROLE fyp_fixture_api_role NOLOGIN;
      GRANT USAGE ON SCHEMA public TO fyp_fixture_api_role;
      GRANT SELECT ON "EmailVerificationToken", "PasswordResetToken", "ExternalAuthIdentity" TO fyp_fixture_api_role;
      SET ROLE fyp_fixture_api_role;
      SELECT (SELECT count(*) FROM "EmailVerificationToken") +
        (SELECT count(*) FROM "PasswordResetToken") +
        (SELECT count(*) FROM "ExternalAuthIdentity");`).split("\n").at(-1), "0");
    assert.equal(query('SELECT count(*) FROM "Route" WHERE "defaultDriverId" IS NULL'), "1");
    assert.equal(query('SELECT count(*) FROM "Route" WHERE "defaultDriverId" IS NOT NULL'), "1");
    assert.equal(query('SELECT count(*) FROM "Bus" WHERE assigned_driver_id IS NOT NULL'), "1");
    console.log("Upgrade: 7 → 9, repeat deploy was a no-op, historical rows and both legacy values preserved; old Route constraint no longer blocks a new Trip-authority route.");
  });
}

void (process.argv.includes("--check-upgrade-runtime") ? checkUpgradeRuntime() : rehearse()).catch((error: Error) => {
  // Assertions can contain fixture secrets or hashes, so report only their source location.
  const location = error.stack?.split("\n").find((line) => line.includes("rehearse-migrations.ts:"));
  console.error("Migration rehearsal failed", location?.trim() ?? error.name);
  process.exitCode = 1;
});
