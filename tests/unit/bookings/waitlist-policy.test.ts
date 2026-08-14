import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { oldestCompatibleWaitlistEntry } from "../../../src/features/bookings/domain/waitlist-policy";

describe("oldest-compatible-first production waitlist policy", () => {
  it("skips an incompatible oldest entry without changing its priority", () => {
    const entries = [
      { id: "oldest", queuedAt: new Date(1) },
      { id: "later", queuedAt: new Date(2) },
    ];
    assert.equal(
      oldestCompatibleWaitlistEntry(entries, (entry) => entry.id === "later")?.id,
      "later",
    );
    assert.equal(
      oldestCompatibleWaitlistEntry(entries, () => true)?.id,
      "oldest",
    );
    assert.equal(entries[0]?.queuedAt.getTime(), 1);
  });
});
