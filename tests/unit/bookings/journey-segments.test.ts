import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveJourneySegments,
  JourneyValidationError,
} from "../../../src/features/bookings/domain/journey-segments";

const segments = [0, 1, 2].map((position) => ({
  id: `segment-${position}`,
  tripId: "trip-1",
  position,
}));

describe("reserved journey segment derivation", () => {
  it("derives every adjacent segment from boarding inclusive to drop-off exclusive", () => {
    const result = deriveJourneySegments(
      { id: "stop-a", tripId: "trip-1", position: 0 },
      { id: "stop-c", tripId: "trip-1", position: 2 },
      segments,
    );
    assert.deepEqual(result.map((segment) => segment.position), [0, 1]);
  });

  it("rejects reverse, cross-Trip, and incomplete journeys", () => {
    assert.throws(
      () =>
        deriveJourneySegments(
          { id: "stop-b", tripId: "trip-1", position: 1 },
          { id: "stop-a", tripId: "trip-1", position: 0 },
          segments,
        ),
      JourneyValidationError,
    );
    assert.throws(
      () =>
        deriveJourneySegments(
          { id: "stop-a", tripId: "trip-1", position: 0 },
          { id: "stop-c", tripId: "trip-2", position: 2 },
          segments,
        ),
      JourneyValidationError,
    );
    assert.throws(
      () =>
        deriveJourneySegments(
          { id: "stop-a", tripId: "trip-1", position: 0 },
          { id: "stop-c", tripId: "trip-1", position: 2 },
          segments.filter((segment) => segment.position !== 1),
        ),
      JourneyValidationError,
    );
  });
});
