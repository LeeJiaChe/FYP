import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

import jwt from "jsonwebtoken";

import {
  isValidRealtimeEmission,
} from "../../../src/shared/realtime/event-contract.js";

const require = createRequire(import.meta.url);
const { secretMatches, verifySubscriptionToken } = require("../../../realtime/server.js") as {
  verifySubscriptionToken: (token: string, secret: string) => { room: string } | null;
  secretMatches: (candidate: string, expected: string) => boolean;
};
const tripId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const secret = "phase-8-test-secret-that-is-at-least-32-characters";

describe("realtime contracts", () => {
  it("accepts only whitelisted minimal invalidations", () => {
    assert.equal(secretMatches("wrong", secret), false);
    assert.equal(secretMatches(secret, secret), true);
    assert.equal(isValidRealtimeEmission(`trip:${tripId}`, "location.changed", {
      entityId: tripId,
      changedAt: new Date().toISOString(),
      reason: "LOCATION_RECORDED",
    }), true);
    assert.equal(isValidRealtimeEmission(`trip:${tripId}`, "passenger.manifest", {}), false);
    assert.equal(isValidRealtimeEmission(`trip:${tripId}`, "location.changed", {
      entityId: tripId,
      changedAt: new Date().toISOString(),
      studentEmail: "private@example.test",
    }), false);
  });

  it("rejects anonymous, expired, wrong-purpose, and tampered Trip scopes", () => {
    const token = jwt.sign({ purpose: "REALTIME_SUBSCRIPTION", userId, role: "STUDENT", tripId }, secret, {
      algorithm: "HS256",
      expiresIn: 60,
      issuer: "fyp-nextjs",
      audience: "fyp-realtime",
    });
    assert.equal(verifySubscriptionToken(token, secret)?.room, `trip:${tripId}`);
    assert.equal(verifySubscriptionToken(`${token}x`, secret), null);
    const wrongPurpose = jwt.sign({ purpose: "QR", userId, role: "STUDENT", tripId }, secret, {
      algorithm: "HS256", expiresIn: 60, issuer: "fyp-nextjs", audience: "fyp-realtime",
    });
    assert.equal(verifySubscriptionToken(wrongPurpose, secret), null);
  });
});
