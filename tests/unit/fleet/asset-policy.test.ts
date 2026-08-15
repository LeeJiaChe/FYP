import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertBusStatusTransition,
  canScheduleBus,
  unavailableBusCancelsFutureTrips,
} from "../../../src/features/fleet/domain/asset-policy";

describe("fleet asset policy", () => {
  it("schedules only ACTIVE Buses", () => {
    assert.equal(canScheduleBus("ACTIVE"), true);
    assert.equal(canScheduleBus("MAINTENANCE"), false);
    assert.equal(canScheduleBus("RETIRED"), false);
  });

  it("treats retirement as terminal and flags availability loss", () => {
    assert.throws(() => assertBusStatusTransition("RETIRED", "ACTIVE"));
    assert.doesNotThrow(() => assertBusStatusTransition("MAINTENANCE", "ACTIVE"));
    assert.equal(unavailableBusCancelsFutureTrips("ACTIVE", "MAINTENANCE"), true);
    assert.equal(unavailableBusCancelsFutureTrips("ACTIVE", "RETIRED"), true);
    assert.equal(unavailableBusCancelsFutureTrips("MAINTENANCE", "RETIRED"), false);
  });
});
