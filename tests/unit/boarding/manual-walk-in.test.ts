import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { selectCurrentStopPendingWalkIns } from "../../../src/features/boarding/domain/manual-walk-in";

describe("Driver manual walk-in worklist", () => {
  const now = new Date("2026-09-04T01:00:00Z");
  const candidate = {
    id: "human-selected-record",
    tripId: "trip-current",
    boardingTripStopId: "stop-current",
    status: "PENDING",
    expiresAt: new Date("2026-09-04T01:01:00Z"),
  };

  it("shows only pending current-Trip and current-stop intents", () => {
    const selected = selectCurrentStopPendingWalkIns(
      [
        candidate,
        { ...candidate, id: "wrong-trip", tripId: "trip-other" },
        { ...candidate, id: "wrong-stop", boardingTripStopId: "stop-other" },
        { ...candidate, id: "boarded", status: "BOARDED" },
        { ...candidate, id: "expired", expiresAt: now },
      ],
      "trip-current",
      "stop-current",
      now,
    );
    assert.deepEqual(selected.map((item) => item.id), ["human-selected-record"]);
  });

  it("returns no candidates while the shuttle is between stops", () => {
    assert.deepEqual(selectCurrentStopPendingWalkIns([candidate], "trip-current", null, now), []);
  });
});
