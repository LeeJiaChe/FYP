import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { currentOperationalSegmentPosition } from "../../../src/features/trips/domain/operational-segment";

const at = new Date("2026-08-15T12:00:00.000Z");
const stop = (position: number, arrival: Date | null, departure: Date | null) => ({
  position,
  actualArrival: arrival,
  actualDeparture: departure,
  passedAt: departure,
});

describe("current operational segment", () => {
  it("uses stop progress and never wall-clock schedule interpolation", () => {
    assert.equal(currentOperationalSegmentPosition("BOARDING", [stop(0, at, null), stop(1, null, null), stop(2, null, null)]), 0);
    assert.equal(currentOperationalSegmentPosition("DEPARTED", [stop(0, at, at), stop(1, at, null), stop(2, null, null)]), 1);
    assert.equal(currentOperationalSegmentPosition("ARRIVED", [stop(0, at, at), stop(1, at, at)]), null);
  });
});

