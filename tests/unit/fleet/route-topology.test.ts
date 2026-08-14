import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  positionRouteStops,
  RouteTopologyError,
} from "../../../src/features/fleet/domain/route-topology";

describe("directional Route topology", () => {
  it("assigns contiguous zero-based positions and requires a null terminal duration", () => {
    const result = positionRouteStops([
      { stopId: "stop-a", travelDurationToNextMinutes: 8 },
      { stopId: "stop-b", travelDurationToNextMinutes: 10 },
      { stopId: "stop-c", travelDurationToNextMinutes: null },
    ]);

    assert.deepEqual(
      result.map((stop) => stop.position),
      [0, 1, 2],
    );
  });

  it("rejects repeated, too-short, too-long, and invalid terminal topology", () => {
    const invalidTopologies = [
      [{ stopId: "stop-a", travelDurationToNextMinutes: null }],
      Array.from({ length: 6 }, (_, index) => ({
        stopId: `stop-${index}`,
        travelDurationToNextMinutes: index === 5 ? null : 5,
      })),
      [
        { stopId: "stop-a", travelDurationToNextMinutes: 5 },
        { stopId: "stop-a", travelDurationToNextMinutes: null },
      ],
      [
        { stopId: "stop-a", travelDurationToNextMinutes: null },
        { stopId: "stop-b", travelDurationToNextMinutes: null },
      ],
      [
        { stopId: "stop-a", travelDurationToNextMinutes: 5 },
        { stopId: "stop-b", travelDurationToNextMinutes: 5 },
      ],
    ];

    for (const topology of invalidTopologies) {
      assert.throws(
        () => positionRouteStops(topology),
        RouteTopologyError,
      );
    }
  });
});
