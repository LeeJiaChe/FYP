import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PASSWORD_RESET_REQUEST_MESSAGE,
  requestStaffPasswordReset,
  resetStaffPassword,
  StaffPasswordResetError,
  type StaffPasswordResetStore,
} from "@/features/identity/application/staff-password-reset";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetTokenUsable,
} from "@/features/identity/domain/password-reset";
import type { TransactionalEmailDelivery } from "@/features/identity/infrastructure/transactional-email.server";

function delivery(options: { preview?: boolean; available?: boolean } = {}) {
  const sent: Array<{ email: string; rawToken: string }> = [];
  const adapter: TransactionalEmailDelivery = {
    available: options.available ?? true,
    preview: options.preview ?? false,
    async deliverStudentVerification() { return {}; },
    async deliverStaffPasswordReset(input) {
      sent.push(input);
      return this.preview
        ? { previewUrl: `http://localhost:3000/reset-password?token=${input.rawToken}` }
        : {};
    },
  };
  return { adapter, sent };
}

describe("staff password reset", () => {
  it("stores only a SHA-256 hash of a strong random token", () => {
    const token = createPasswordResetToken(
      new Date("2026-09-05T00:00:00Z"),
      60_000,
      () => "raw-secret-token",
    );
    assert.match(token.tokenHash, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(token.tokenHash, /raw-secret-token/);
    assert.equal(token.tokenHash, hashPasswordResetToken(token.rawToken));
  });

  it("rejects expired and consumed tokens", () => {
    const now = new Date("2026-09-05T00:00:00Z");
    assert.equal(isPasswordResetTokenUsable({ expiresAt: now, consumedAt: null }, now), false);
    assert.equal(isPasswordResetTokenUsable({ expiresAt: new Date(now.getTime() + 1), consumedAt: now }, now), false);
  });

  it("returns the same public message for nonexistent, Student, Driver, and Admin requests", async () => {
    const messages: string[] = [];
    for (const target of [null, null, { email: "driver@tarumt.edu.my" }, { email: "admin@admin.tarc.edu.my" }]) {
      const store: StaffPasswordResetStore = {
        async createIfEligible() { return target; },
        async consume() { return "INVALID"; },
      };
      const mail = delivery();
      const result = await requestStaffPasswordReset({
        email: target?.email ?? "unknown@student.tarc.edu.my",
        store,
        delivery: mail.adapter,
        now: new Date("2026-09-05T00:00:00Z"),
      });
      messages.push(result.message);
    }
    assert.deepEqual(messages, Array(4).fill(PASSWORD_RESET_REQUEST_MESSAGE));
  });

  it("does not deliver for a Student but delivers to eligible Driver/Admin destinations", async () => {
    for (const preview of [false, true]) {
      for (const target of [null, { email: "driver@tarumt.edu.my" }, { email: "admin@admin.tarc.edu.my" }]) {
        const mail = delivery({ preview });
        const store: StaffPasswordResetStore = {
          async createIfEligible() { return target; },
          async consume() { return "INVALID"; },
        };
        const result = await requestStaffPasswordReset({
          email: target?.email ?? "student@student.tarc.edu.my",
          store,
          delivery: mail.adapter,
          now: new Date("2026-09-05T00:00:00Z"),
        });
        assert.equal(mail.sent.length, target ? 1 : 0);
        if (target) {
          assert.equal(mail.sent[0]?.email, target.email);
          if (preview) {
            assert.match(result.previewUrl ?? "", /^http:\/\/localhost:3000\/reset-password\?token=/);
          }
        } else {
          assert.equal(result.previewUrl, undefined);
        }
      }
    }
  });

  it("rotates a hashed token through the store and never persists the raw token", async () => {
    let storedHash = "";
    const mail = delivery();
    const store: StaffPasswordResetStore = {
      async createIfEligible(input) { storedHash = input.tokenHash; return { email: input.email }; },
      async consume() { return "INVALID"; },
    };
    await requestStaffPasswordReset({
      email: "driver@tarumt.edu.my",
      store,
      delivery: mail.adapter,
      now: new Date("2026-09-05T00:00:00Z"),
    });
    const rawToken = mail.sent[0]?.rawToken ?? "";
    assert.equal(storedHash, hashPasswordResetToken(rawToken));
    assert.notEqual(storedHash, rawToken);
  });

  it("fails closed without production delivery before creating a token record", async () => {
    let storeCalled = false;
    const store: StaffPasswordResetStore = {
      async createIfEligible() { storeCalled = true; return null; },
      async consume() { return "INVALID"; },
    };
    const result = await requestStaffPasswordReset({
      email: "driver@tarumt.edu.my",
      store,
      delivery: delivery({ available: false }).adapter,
    });
    assert.equal(result.message, PASSWORD_RESET_REQUEST_MESSAGE);
    assert.equal(storeCalled, false);
  });

  it("changes the password once and models session-version revocation", async () => {
    let consumed = false;
    let sessionVersion = 4;
    let storedPasswordHash = "old-hash";
    const store: StaffPasswordResetStore = {
      async createIfEligible() { return null; },
      async consume(input) {
        if (consumed || input.tokenHash !== hashPasswordResetToken("one-time-token")) return "INVALID";
        consumed = true;
        storedPasswordHash = input.passwordHash;
        sessionVersion += 1;
        return "RESET";
      },
    };
    const result = await resetStaffPassword({
      rawToken: "one-time-token",
      password: "NewPassword123",
      store,
      now: new Date("2026-09-05T00:00:00Z"),
    });
    assert.deepEqual(result, { reset: true });
    assert.notEqual(storedPasswordHash, "NewPassword123");
    assert.equal(sessionVersion, 5);
    await assert.rejects(
      resetStaffPassword({ rawToken: "one-time-token", password: "AnotherPassword123", store }),
      (error) => error instanceof StaffPasswordResetError && error.code === "TOKEN_INVALID",
    );
  });
});
