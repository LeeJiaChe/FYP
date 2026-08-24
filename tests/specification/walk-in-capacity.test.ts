import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAdmitStandingJourney,
  issueWalkInIntent,
  SerializedStandingAdmissionFixture,
} from "./support/reference-policies";

describe("walk-in standing-capacity specifications", () => {
  it("consumes zero standing capacity when a Walk-in Pass is issued", () => {
    const intent = issueWalkInIntent({ boardingIndex: 0, dropOffIndex: 2 });

    assert.equal(intent.kind, "WALK_IN");
    assert.deepEqual(intent.standingClaims, []);
  });

  it("requires capacity on every requested segment", () => {
    const occupancy = new Map([
      [0, 9],
      [1, 10],
    ]);

    assert.equal(
      canAdmitStandingJourney(
        occupancy,
        10,
        { boardingIndex: 0, dropOffIndex: 2 },
        3,
      ),
      false,
    );
    assert.equal(
      canAdmitStandingJourney(
        occupancy,
        10,
        { boardingIndex: 0, dropOffIndex: 1 },
        3,
      ),
      true,
    );
  });

  it("serializes simultaneous claims for the final standing place", async () => {
    const admission = new SerializedStandingAdmissionFixture(10, 3);
    admission.seed(0, 9);
    admission.seed(1, 9);

    const results = await Promise.all([
      admission.admit({ boardingIndex: 0, dropOffIndex: 2 }),
      admission.admit({ boardingIndex: 0, dropOffIndex: 2 }),
    ]);

    assert.deepEqual(results.sort(), [false, true]);
    assert.equal(admission.occupancy(0), 10);
    assert.equal(admission.occupancy(1), 10);
  });
});
