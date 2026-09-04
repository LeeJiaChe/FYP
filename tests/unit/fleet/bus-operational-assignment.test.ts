import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveBusOperationalAssignment,
  type BusAssignmentTrip,
} from "../../../src/features/fleet/domain/bus-operational-assignment";

const now = new Date("2026-09-04T08:15:00.000Z");

function trip(
  id: string,
  status: BusAssignmentTrip["status"],
  departureTime: string,
  busId = "bus-a",
): BusAssignmentTrip {
  return { id, busId, status, departureTime };
}

describe("Bus Current / Next Assignment", () => {
  it("derives one current operation and the earliest future assignment", () => {
    const result = deriveBusOperationalAssignment(
      [
        trip("next-later", "NOT_STARTED", "2026-09-04T09:00:00.000Z"),
        trip("current", "DEPARTED", "2026-09-04T08:00:00.000Z"),
        trip("next", "NOT_STARTED", "2026-09-04T08:30:00.000Z"),
      ],
      "bus-a",
      now,
    );

    assert.equal(result.state, "NORMAL");
    assert.equal(result.current?.id, "current");
    assert.equal(result.next?.id, "next");
  });

  it("uses the earliest future NOT_STARTED Trip when no operation is active", () => {
    const result = deriveBusOperationalAssignment(
      [
        trip("overdue", "NOT_STARTED", "2026-09-04T08:00:00.000Z"),
        trip("arrived", "ARRIVED", "2026-09-04T08:05:00.000Z"),
        trip("future", "NOT_STARTED", "2026-09-04T08:45:00.000Z"),
      ],
      "bus-a",
      now,
    );

    assert.equal(result.current, null);
    assert.equal(result.next?.id, "future");
  });

  it("fails safe instead of choosing arbitrarily among multiple active Trips", () => {
    const result = deriveBusOperationalAssignment(
      [
        trip("departed", "DEPARTED", "2026-09-04T08:00:00.000Z"),
        trip("boarding", "BOARDING", "2026-09-04T07:30:00.000Z"),
      ],
      "bus-a",
      now,
    );

    assert.equal(result.state, "MULTIPLE_ACTIVE_TRIPS");
    assert.equal(result.current, null);
    assert.deepEqual(result.conflictTripIds, ["boarding", "departed"]);
  });

  it("returns no context for unrelated, historical, or cancelled Trips", () => {
    const result = deriveBusOperationalAssignment(
      [
        trip("other-bus", "BOARDING", "2026-09-04T08:00:00.000Z", "bus-b"),
        trip("cancelled", "CANCELLED", "2026-09-04T09:00:00.000Z"),
      ],
      "bus-a",
      now,
    );

    assert.equal(result.current, null);
    assert.equal(result.next, null);
  });
});
