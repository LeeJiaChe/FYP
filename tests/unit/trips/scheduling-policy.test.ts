import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canEditSchedule,
  hasPassengerState,
  intervalsOverlap,
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
});
