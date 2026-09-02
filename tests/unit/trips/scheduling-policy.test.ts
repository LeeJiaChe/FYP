import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canEditSchedule,
  hasPassengerState,
  intervalsOverlap,
  isSameServiceDate,
  toServiceDateKey,
} from "../../../src/features/trips/domain/scheduling-policy";

describe("Trip scheduling policy", () => {
  it("uses half-open overlap semantics", () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute));
    assert.equal(intervalsOverlap(at(0), at(10), at(9), at(20)), true);
    assert.equal(intervalsOverlap(at(0), at(10), at(10), at(20)), false);
  });

  it("permits schedule edits only for empty NOT_STARTED Trips", () => {
    const empty = { bookings: 0, waitlistEntries: 0, walkInIntents: 0, walkInJourneys: 0 };
    assert.equal(hasPassengerState(empty), false);
    assert.equal(canEditSchedule("NOT_STARTED", empty), true);
    assert.equal(canEditSchedule("BOARDING", empty), false);
    assert.equal(canEditSchedule("NOT_STARTED", { ...empty, waitlistEntries: 1 }), false);
  });

  it("extracts and compares Malaysia operational service dates deterministically", () => {
    // 2026-09-02 01:00 UTC is 2026-09-02 09:00 in Malaysia
    assert.equal(toServiceDateKey(new Date("2026-09-02T01:00:00.000Z")), "2026-09-02");
    // 2026-09-01 17:00 UTC is 2026-09-02 01:00 in Malaysia
    assert.equal(toServiceDateKey(new Date("2026-09-01T17:00:00.000Z")), "2026-09-02");
    // DB date 2026-09-02
    assert.equal(toServiceDateKey("2026-09-02"), "2026-09-02");

    assert.equal(
      isSameServiceDate(new Date("2026-09-02T00:00:00.000Z"), new Date("2026-09-02T08:30:00.000+08:00")),
      true,
    );
    assert.equal(
      isSameServiceDate(new Date("2026-09-02T00:00:00.000Z"), new Date("2026-09-03T08:30:00.000+08:00")),
      false,
    );
  });
});
