import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveAdminMonitoredTripId,
  selectAdminActiveTrips,
} from "../../../src/features/trips/domain/admin-live-operation";

const trips = [
  { id: "not-started", status: "NOT_STARTED" as const },
  { id: "boarding", status: "BOARDING" as const },
  { id: "departed", status: "DEPARTED" as const },
  { id: "arrived", status: "ARRIVED" as const },
  { id: "cancelled", status: "CANCELLED" as const },
];

describe("Admin Live Operations Trip selection", () => {
  it("admits only BOARDING and DEPARTED Trips", () => {
    assert.deepEqual(
      selectAdminActiveTrips(trips).map((trip) => trip.id),
      ["boarding", "departed"],
    );
  });

  it("defaults to the first active Trip and preserves an active selection", () => {
    assert.equal(resolveAdminMonitoredTripId(trips, null), "boarding");
    assert.equal(
      resolveAdminMonitoredTripId(trips, "departed"),
      "departed",
    );
  });

  for (const terminalStatus of ["ARRIVED", "CANCELLED"] as const) {
    it(`moves a ${terminalStatus} selection to another active Trip`, () => {
      const refreshedTrips = [
        { id: "terminal", status: terminalStatus },
        { id: "replacement", status: "DEPARTED" as const },
      ];

      assert.equal(
        resolveAdminMonitoredTripId(refreshedTrips, "terminal"),
        "replacement",
      );
    });
  }

  it("clears the selection when no active operation remains", () => {
    const refreshedTrips = [
      { id: "arrived", status: "ARRIVED" },
      { id: "cancelled", status: "CANCELLED" },
    ] as const;

    assert.equal(resolveAdminMonitoredTripId(refreshedTrips, "arrived"), null);
  });
});
