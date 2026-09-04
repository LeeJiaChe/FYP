import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getOperationsAnalytics } from "../../../src/features/analytics/application/analytics";
import {
  askOperationsIntelligence,
  interpretOperationsIntelligence,
} from "../../../src/features/analytics/application/operations-intelligence";

describe("Operations Intelligence authorization", () => {
  it("rejects Student and Driver actors before any analytics query or Gemini call", async () => {
    await assert.rejects(
      getOperationsAnalytics({ role: "STUDENT" }, {}),
      /Admin role required/,
    );
    await assert.rejects(
      askOperationsIntelligence({ role: "DRIVER" }, {
        question: "What changed?",
        from: new Date("2026-09-01T00:00:00Z"),
        to: new Date("2026-09-08T00:00:00Z"),
      }),
      /Admin role required/,
    );
    await assert.rejects(
      interpretOperationsIntelligence({ role: "STUDENT" }, {
        fingerprint: "a".repeat(64),
        from: new Date("2026-09-01T00:00:00Z"),
        to: new Date("2026-09-08T00:00:00Z"),
      }),
      /Admin role required/,
    );
  });
});
