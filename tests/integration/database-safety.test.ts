import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";

import { fixtureTarget, assertFixtureIdentity } from "../../src/shared/db/disposable-fixture";
import { verifyTestDatabaseEnvironment } from "../../scripts/verify-test-database";

describe("integration database safety", () => {
  it("never falls back to the development database or an operator-supplied target", async () => {
    await assert.rejects(verifyTestDatabaseEnvironment({
      DATABASE_URL: "postgresql://localhost/fyp_bus",
      TEST_DATABASE_CONFIRM: "FYP_BUS_INTEGRATION",
    }), /private fixture directory/);
    for (const url of ["file:./test.db", "postgresql://localhost/fyp_bus_test",
      "postgresql://shared.invalid/fyp_bus_test", "postgresql://127.0.0.1/fyp_bus_test"]) {
      await assert.rejects(verifyTestDatabaseEnvironment({
        ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url,
      }), /exactly match the provisioned fixture target/);
    }
  });

  it("rejects ambiguous aliases and overrides before connecting", async () => {
    const target = fixtureTarget(process.env);
    for (const url of [`${target.url}&schema=integration`, target.url.replace("@localhost:", "@127.0.0.1:")]) {
      await assert.rejects(verifyTestDatabaseEnvironment({
        ...process.env, DATABASE_URL: url,
      }), /exactly match/);
    }
  });

  it("requires an explicit destructive-test acknowledgement", async () => {
    await assert.rejects(verifyTestDatabaseEnvironment({
      ...process.env, TEST_DATABASE_CONFIRM: "incorrect",
    }), /acknowledgement/);
  });

  it("checks the actual server and rejects wrong, missing or unreachable provisioning identities", async () => {
    const target = fixtureTarget(process.env);
    const client = new PrismaClient({ datasourceUrl: target.url });
    const otherSocket = new URL(target.url);
    otherSocket.searchParams.set("host", `${target.root}/absent`);
    const disconnected = new PrismaClient({ datasourceUrl: otherSocket.toString() });
    try {
      await assertFixtureIdentity(client, target);
      await assert.rejects(assertFixtureIdentity(client, { ...target, nonce: "" }), /did not identify/);
      await assert.rejects(assertFixtureIdentity(disconnected, target), /identity is unavailable/);
    } finally {
      await client.$disconnect();
      await disconnected.$disconnect();
    }
  });

  it("refuses unsafe seed invocations before the first fixture write", async () => {
    const target = await verifyTestDatabaseEnvironment(process.env);
    const client = new PrismaClient({ datasourceUrl: target.url });
    try {
      const sentinel = await client.stop.create({ data: {
        code: "R1_SEED_SENTINEL", name: "Synthetic seed guard", latitude: 3, longitude: 101,
      } });
      const result = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
        env: { ...process.env, TEST_DATABASE_URL: "" }, encoding: "utf8",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /seed refused/);
      assert.ok(await client.stop.findUnique({ where: { id: sentinel.id } }));
    } finally {
      await client.$disconnect();
    }
  });
});
