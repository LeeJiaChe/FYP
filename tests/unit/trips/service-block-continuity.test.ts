import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateServiceBlockContinuity } from "../../../src/features/trips/domain/service-block-continuity";

function topology(...stopIds: string[]) {
  return {
    tripStops: stopIds.map((stopId, position) => ({ stopId, position })),
  };
}

describe("ServiceBlock turnaround continuity", () => {
  it("recognizes TAR to PV18 followed by PV18 to TAR as continuous", () => {
    assert.equal(
      evaluateServiceBlockContinuity(
        topology("TAR_GATE_7", "PV18"),
        topology("PV18", "TAR_GATE_7"),
      ),
      "CONTINUOUS",
    );
  });

  it("returns a non-fatal deadhead warning for mismatched terminals", () => {
    assert.equal(
      evaluateServiceBlockContinuity(
        topology("TAR_GATE_7", "PV18"),
        topology("WANGSA_MAJU", "TAR_GATE_7"),
      ),
      "DEADHEAD_REQUIRED",
    );
  });
});
