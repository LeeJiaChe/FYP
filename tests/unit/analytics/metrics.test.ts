import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { noShowPercent, utilizationPercent } from "../../../src/features/analytics/domain/metrics";

describe("journey-aware analytics formulas", () => {
  it("uses segment capacity denominators and handles zero standing capacity", () => {
    assert.equal(utilizationPercent(45, 30 * 3), 50);
    assert.equal(utilizationPercent(3, 0), 0);
    assert.equal(noShowPercent(2, 8), 25);
  });
});

