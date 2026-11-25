import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, it } from "node:test";

import { requestStaffPasswordReset, resetStaffPassword } from "../../src/features/identity/application/staff-password-reset";
import { staffPasswordResetStore } from "../../src/features/identity/infrastructure/staff-password-reset.prisma.server";
import { createTransactionalEmailDelivery } from "../../src/features/identity/infrastructure/transactional-email.server";
import { getTransactionalEmailDelivery } from "../../src/features/identity/infrastructure/transactional-email-composition.server";
import { prisma } from "../../src/shared/db/prisma.server";

after(() => prisma.$disconnect());

it("keeps public reset responses generic and secrets inside a legitimate fake transport", async () => {
  const account = await prisma.user.create({
    data: { name: "Synthetic Recovery Staff", email: `${randomUUID()}@example.test`, role: "DRIVER", passwordHash: "fixture-only" },
  });
  const configuration = { runtime: "development", apiKey: "fake-configured", from: "sender@example.test", appBaseUrl: "https://fixture.example.test" } as const;
  let deliveryCount = 0;
  const delivery = createTransactionalEmailDelivery(configuration, {
    async send() { deliveryCount++; },
  });
  const input = { store: staffPasswordResetStore, delivery };
  const eligible = await requestStaffPasswordReset({ ...input, email: account.email });
  const unknown = await requestStaffPasswordReset({ ...input, email: `${randomUUID()}@example.test` });
  assert.deepEqual(eligible, unknown);
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(eligible))), ["message"]);
  assert.equal(deliveryCount, 1);
  assert.equal(await prisma.passwordResetToken.count({ where: { userId: account.id } }), 1);
});

it("requires explicit preview plus the live fixture identity and a matching loopback app origin", async () => {
  const old = { ...process.env };
  try {
    assert.equal((await getTransactionalEmailDelivery()).preview, false, "isolated previews are opt-in");
    process.env.FIXTURE_EMAIL_PREVIEW_ENABLED = "true";
    process.env.FYP_FIXTURE_APP_PORT = "3001";
    assert.equal((await getTransactionalEmailDelivery()).preview, false, "the declared fixture origin must match");
    process.env.FYP_FIXTURE_APP_PORT = "3000";
    assert.equal((await getTransactionalEmailDelivery()).preview, true);
    process.env.DATABASE_URL = "postgresql://127.0.0.1:1/not_the_fixture";
    assert.equal((await getTransactionalEmailDelivery()).preview, false, "explicit flags cannot authorize a different database");
  } finally {
    process.env = old;
  }
});

it("serializes reset consumption, rejects expired and reused credentials, and revokes the prior session once", async () => {
  const account = await prisma.user.create({
    data: { name: "Synthetic Concurrent Staff", email: `${randomUUID()}@example.test`, role: "ADMIN", passwordHash: "fixture-only" },
  });
  let raw = "";
  const delivery = createTransactionalEmailDelivery({
    runtime: "test", apiKey: "fake-configured", from: "sender@example.test", appBaseUrl: "https://fixture.example.test",
  }, {
    async send(input) {
      const link = input.text.split(" ").at(-1);
      raw = new URL(link!).searchParams.get("token")!;
    },
  });
  const issue = (now: Date) => requestStaffPasswordReset({ email: account.email, delivery, store: staffPasswordResetStore, now });
  const reset = () => resetStaffPassword({ rawToken: raw, password: "A synthetic long password 29", store: staffPasswordResetStore });
  await issue(new Date(Date.now() - 86_400_000));
  await assert.rejects(reset, /invalid, expired, or already used/);
  await issue(new Date());

  const results = await Promise.allSettled([reset(), reset()]);
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  await assert.rejects(reset, /invalid, expired, or already used/);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(user.sessionVersion, account.sessionVersion + 1);
  const tokens = await prisma.passwordResetToken.findMany({ where: { userId: account.id } });
  assert.equal(tokens.length, 2);
  assert.ok(tokens.every((token) => /^[a-f0-9]{64}$/.test(token.tokenHash) && token.tokenHash !== raw));
});
