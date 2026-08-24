import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  oldestCompatibleWaitlistEntry,
  type WaitlistFixture,
} from "./support/reference-policies";

describe("oldest-compatible-first waitlist specification", () => {
  it("skips an incompatible entry without changing its future priority", () => {
    const entries: WaitlistFixture[] = [
      {
        id: "oldest-a-to-c",
        queuedAt: 1,
        journey: { boardingIndex: 0, dropOffIndex: 2 },
      },
      {
        id: "later-b-to-c",
        queuedAt: 2,
        journey: { boardingIndex: 1, dropOffIndex: 2 },
      },
    ];

    const firstAttempt = oldestCompatibleWaitlistEntry(
      entries,
      [{ seatNumber: 5, occupiedSegments: new Set([0]) }],
      3,
    );
    assert.equal(firstAttempt?.id, "later-b-to-c");

    const laterAttempt = oldestCompatibleWaitlistEntry(
      entries,
      [{ seatNumber: 5, occupiedSegments: new Set() }],
      3,
    );
    assert.equal(laterAttempt?.id, "oldest-a-to-c");
    assert.equal(entries[0]?.queuedAt, 1);
  });
});
