import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  confirmActualAlighting,
  firstSeatFreeForWholeJourney,
  isSeatAvailable,
  type ReservedJourneyFixture,
} from "./support/reference-policies";

describe("reserved segment allocation specifications", () => {
  it("allows adjacent journeys to reuse the same seat", () => {
    const seat5OnAB = new Set([0]);

    assert.equal(
      isSeatAvailable(
        seat5OnAB,
        { boardingIndex: 1, dropOffIndex: 2 },
        3,
      ),
      true,
    );
  });

  it("rejects overlapping journeys on the same seat", () => {
    const seat5OnAB = new Set([0]);

    assert.equal(
      isSeatAvailable(
        seat5OnAB,
        { boardingIndex: 0, dropOffIndex: 2 },
        3,
      ),
      false,
    );
  });

  it("requires one seat to be free across every requested segment", () => {
    const available = firstSeatFreeForWholeJourney(
      [
        { seatNumber: 1, occupiedSegments: new Set([0]) },
        { seatNumber: 2, occupiedSegments: new Set([1]) },
      ],
      { boardingIndex: 0, dropOffIndex: 2 },
      3,
    );

    assert.equal(available, undefined);
  });

  it("does not change planned allocation when actual alighting is recorded", () => {
    const journey: ReservedJourneyFixture = {
      plannedSegments: [0, 1],
      actualAlightedAt: null,
    };

    const alighted = confirmActualAlighting(
      journey,
      "2026-08-14T08:30:00.000Z",
    );

    assert.deepEqual(alighted.plannedSegments, [0, 1]);
    assert.equal(alighted.actualAlightedAt, "2026-08-14T08:30:00.000Z");
  });
});
