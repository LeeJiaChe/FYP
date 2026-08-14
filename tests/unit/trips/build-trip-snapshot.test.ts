import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTripSnapshot,
  TripSnapshotError,
} from "../../../src/features/trips/domain/build-trip-snapshot";

const originDeparture = new Date("2026-08-16T00:00:00.000Z");
const routeStops = [
  {
    stopId: "stop-a",
    position: 0,
    stopCode: "A",
    stopName: "Stop A",
    latitude: 3.2,
    longitude: 101.7,
    travelDurationToNextMinutes: 8,
  },
  {
    stopId: "stop-b",
    position: 1,
    stopCode: "B",
    stopName: "Stop B",
    latitude: 3.21,
    longitude: 101.71,
    travelDurationToNextMinutes: 10,
  },
  {
    stopId: "stop-c",
    position: 2,
    stopCode: "C",
    stopName: "Stop C",
    latitude: 3.22,
    longitude: 101.72,
    travelDurationToNextMinutes: null,
  },
] as const;

describe("Trip topology snapshot", () => {
  it("derives zero-dwell stop times, deadlines, segments, and seats", () => {
    const snapshot = buildTripSnapshot({
      originDeparture,
      boardingCloseGraceMs: 5 * 60 * 1_000,
      seatedCapacity: 3,
      standingCapacity: 2,
      routeStops,
    });

    assert.deepEqual(
      snapshot.stops.map((stop) => stop.plannedDeparture.toISOString()),
      [
        "2026-08-16T00:00:00.000Z",
        "2026-08-16T00:08:00.000Z",
        "2026-08-16T00:18:00.000Z",
      ],
    );
    assert.ok(
      snapshot.stops.every(
        (stop) =>
          stop.plannedArrival.getTime() === stop.plannedDeparture.getTime(),
      ),
    );
    assert.deepEqual(snapshot.segmentPositions, [0, 1]);
    assert.deepEqual(snapshot.seatNumbers, [1, 2, 3]);
    assert.equal(
      snapshot.stops[1]?.boardingDeadline.toISOString(),
      "2026-08-16T00:13:00.000Z",
    );
    assert.equal(
      snapshot.estimatedArrivalTime.toISOString(),
      "2026-08-16T00:18:00.000Z",
    );
  });

  it("rejects invalid capacity and non-contiguous RouteStop positions", () => {
    assert.throws(
      () =>
        buildTripSnapshot({
          originDeparture,
          boardingCloseGraceMs: 0,
          seatedCapacity: 0,
          standingCapacity: 0,
          routeStops,
        }),
      TripSnapshotError,
    );
    assert.throws(
      () =>
        buildTripSnapshot({
          originDeparture,
          boardingCloseGraceMs: 0,
          seatedCapacity: 1,
          standingCapacity: 0,
          routeStops: routeStops.map((stop, index) => ({
            ...stop,
            position: index + 1,
          })),
        }),
      /contiguous and zero-based/,
    );
  });
});
