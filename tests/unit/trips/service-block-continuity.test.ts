import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateServiceBlockContinuity } from "../../../src/features/trips/domain/service-block-continuity";

const policy = { minimumServiceBlockTurnaroundMs: 10 * 60_000 };

function trip(
  departure: string,
  arrival: string,
  ...stops: Array<[string, string]>
) {
  return {
    departureTime: new Date(departure),
    estimatedArrivalTime: new Date(arrival),
    tripStops: stops.map(([stopId, stopName], position) => ({ stopId, stopName, position })),
  };
}

describe("ServiceBlock operational feasibility", () => {
  const previous = trip(
    "2026-09-04T00:00:00Z",
    "2026-09-04T00:30:00Z",
    ["TAR", "Gate 7"],
    ["PV18", "PV18"],
  );

  it("accepts a same-stop sequence with adequate turnaround", () => {
    const result = evaluateServiceBlockContinuity(
      previous,
      trip("2026-09-04T00:40:00Z", "2026-09-04T01:10:00Z", ["PV18", "PV18"], ["TAR", "Gate 7"]),
      policy,
    );
    assert.equal(result.status, "CONTINUOUS_OK");
    assert.equal(result.gapMinutes, 10);
  });

  it("warns when same-stop turnaround is too short", () => {
    const result = evaluateServiceBlockContinuity(
      previous,
      trip("2026-09-04T00:35:00Z", "2026-09-04T01:05:00Z", ["PV18", "PV18"], ["TAR", "Gate 7"]),
      policy,
    );
    assert.equal(result.status, "TURNAROUND_TOO_SHORT");
    assert.match(result.message, /unload, prepare and board/);
  });

  it("warns about an unquantified deadhead when terminals differ", () => {
    const result = evaluateServiceBlockContinuity(
      previous,
      trip("2026-09-04T00:50:00Z", "2026-09-04T01:20:00Z", ["WM", "Wangsa Maju"], ["TAR", "Gate 7"]),
      policy,
    );
    assert.equal(result.status, "DEADHEAD_REQUIRED");
    assert.match(result.message, /no authoritative deadhead duration/);
  });

  it("flags a short deadhead gap without inventing travel time", () => {
    const result = evaluateServiceBlockContinuity(
      previous,
      trip("2026-09-04T00:35:00Z", "2026-09-04T01:05:00Z", ["TAR", "Gate 7"], ["WM", "Wangsa Maju"]),
      policy,
    );
    assert.equal(result.status, "DEADHEAD_TIME_INSUFFICIENT");
    assert.match(result.message, /may be operationally insufficient/);
  });
});
