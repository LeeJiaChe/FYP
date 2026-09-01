import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDriverOperation } from "../../../src/features/trips/domain/driver-operation";

const driverId = "driver-a";
const departure = new Date("2026-09-01T10:00:00.000Z");

function trip(
  id: string,
  status: "NOT_STARTED" | "BOARDING" | "DEPARTED" | "ARRIVED" | "CANCELLED",
  departureTime = departure,
  assignedDriverId: string | null = driverId,
) {
  return { id, status, departureTime, driverId: assignedDriverId };
}

function resolve(
  now: string,
  trips: ReturnType<typeof trip>[],
) {
  return resolveDriverOperation({
    driverId,
    trips,
    now: new Date(now),
    boardingOpenLeadMs: 15 * 60 * 1_000,
  });
}

describe("server-authoritative Driver operation resolution", () => {
  it("keeps a 10:00 Trip upcoming at 09:44:59", () => {
    const result = resolve("2026-09-01T09:44:59.000Z", [trip("next", "NOT_STARTED")]);
    assert.equal(result.currentTrip, null);
    assert.equal(result.nextTrip?.id, "next");
    assert.equal(result.state, "UPCOMING");
  });

  it("activates a 10:00 Trip exactly at the 09:45 boarding window", () => {
    const result = resolve("2026-09-01T09:45:00.000Z", [trip("ready", "NOT_STARTED")]);
    assert.equal(result.currentTrip?.id, "ready");
    assert.equal(result.reason, "BOARDING_WINDOW_OPEN");
    assert.equal(result.currentTrip?.status, "NOT_STARTED");
  });

  for (const status of ["BOARDING", "DEPARTED"] as const) {
    it(`${status} remains current after the next Trip's planned time`, () => {
      const result = resolve("2026-09-01T10:40:00.000Z", [
        trip("ongoing", status, new Date("2026-09-01T10:00:00.000Z")),
        trip("next", "NOT_STARTED", new Date("2026-09-01T10:30:00.000Z")),
      ]);
      assert.equal(result.currentTrip?.id, "ongoing");
      assert.equal(result.nextTrip?.id, "next");
      assert.equal(result.reason, "ONGOING_TRIP");
    });
  }

  for (const terminalStatus of ["ARRIVED", "CANCELLED"] as const) {
    it(`advances after the current Trip becomes ${terminalStatus}`, () => {
      const result = resolve("2026-09-01T10:20:00.000Z", [
        trip("terminal", terminalStatus, new Date("2026-09-01T10:00:00.000Z")),
        trip("next", "NOT_STARTED", new Date("2026-09-01T10:30:00.000Z")),
      ]);
      assert.equal(result.currentTrip?.id, "next");
    });
  }

  it("never selects terminal, other-Driver, or unassigned Trips", () => {
    const result = resolve("2026-09-01T12:00:00.000Z", [
      trip("arrived", "ARRIVED"),
      trip("cancelled", "CANCELLED"),
      trip("other", "NOT_STARTED", departure, "driver-b"),
      trip("unassigned", "NOT_STARTED", departure, null),
    ]);
    assert.equal(result.state, "NO_ASSIGNMENT");
    assert.equal(result.currentTrip, null);
    assert.equal(result.nextTrip, null);
  });

  it("fails safe when more than one active Trip exists", () => {
    const result = resolve("2026-09-01T10:40:00.000Z", [
      trip("boarding", "BOARDING"),
      trip("departed", "DEPARTED"),
    ]);
    assert.equal(result.state, "MULTIPLE_ACTIVE_TRIPS");
    assert.equal(result.currentTrip, null);
    assert.deepEqual(result.conflictTripIds, ["boarding", "departed"]);
  });

  it("has no requested Trip ID input that can override server ordering", () => {
    const result = resolve("2026-09-01T09:50:00.000Z", [
      trip("later", "NOT_STARTED", new Date("2026-09-01T10:30:00.000Z")),
      trip("earliest", "NOT_STARTED", new Date("2026-09-01T10:00:00.000Z")),
    ]);
    assert.equal(result.currentTrip?.id, "earliest");
  });

  it("retains an overdue unperformed NOT_STARTED Trip instead of silently skipping it", () => {
    // 08:00 Trip was never started/cancelled; at 10:05 another Trip is scheduled at 10:00
    const result = resolve("2026-09-01T10:05:00.000Z", [
      trip("overdue", "NOT_STARTED", new Date("2026-09-01T08:00:00.000Z")),
      trip("scheduled-10am", "NOT_STARTED", new Date("2026-09-01T10:00:00.000Z")),
    ]);
    assert.equal(result.state, "CURRENT_OPERATION");
    assert.equal(result.currentTrip?.id, "overdue");
    assert.equal(result.nextTrip?.id, "scheduled-10am");
    assert.equal(result.reason, "BOARDING_WINDOW_OPEN");
  });
});
