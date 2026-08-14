import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createProductPolicy } from "../../../src/shared/config/policies";
import { fixedClock } from "../../../src/shared/time/clock";

const issuedAt = new Date("2026-08-15T04:00:00.000Z");
const policy = createProductPolicy({ qrTokenLifetimeSeconds: 60 });
const durableClaims = {
  purpose: "WALK_IN_BOARDING" as const,
  journeyKind: "WALK_IN" as const,
  recordId: "00000000-0000-4000-8000-000000000001",
  studentId: "00000000-0000-4000-8000-000000000002",
  tripId: "00000000-0000-4000-8000-000000000003",
};

async function passModule() {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/fyp_bus_dev",
    JWT_SECRET: "unit-session-secret-at-least-32-characters",
    QR_SECRET: "unit-qr-secret-distinct-at-least-32-characters",
    REALTIME_URL: "http://localhost:4000",
    REALTIME_SERVICE_SECRET: "unit-realtime-secret-at-least-32-characters",
  });
  return import(
    "../../../src/features/boarding/infrastructure/pass-token.server"
  );
}

describe("Phase 5 production pass signing", () => {
  it("round-trips every required timed claim through the real signer", async () => {
    const { issueSignedPass, verifySignedPass } = await passModule();
    const pass = await issueSignedPass(durableClaims, fixedClock(issuedAt), policy);
    const verified = verifySignedPass(
      pass.token,
      fixedClock(new Date(issuedAt.getTime() + 59_000)),
    );

    assert.deepEqual(
      {
        purpose: verified.purpose,
        journeyKind: verified.journeyKind,
        recordId: verified.recordId,
        studentId: verified.studentId,
        tripId: verified.tripId,
        issuedAt: verified.issuedAt,
        expiresAt: verified.expiresAt,
      },
      {
        ...durableClaims,
        issuedAt: Math.floor(issuedAt.getTime() / 1_000),
        expiresAt: Math.floor(issuedAt.getTime() / 1_000) + 60,
      },
    );
    assert.match(verified.tokenId, /^[0-9a-f-]{36}$/);
  });

  it("rejects the same token at its exact expiry boundary", async () => {
    const { issueSignedPass, PassTokenError, verifySignedPass } =
      await passModule();
    const pass = await issueSignedPass(durableClaims, fixedClock(issuedAt), policy);
    assert.throws(
      () =>
        verifySignedPass(
          pass.token,
          fixedClock(new Date(issuedAt.getTime() + 60_000)),
        ),
      (error) => error instanceof PassTokenError && error.code === "EXPIRED",
    );
  });
});
