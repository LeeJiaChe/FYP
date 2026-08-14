import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ingestLocation,
  toConsumerLocation,
  type BoardingPassFixture,
  type LocationInputFixture,
} from "./support/reference-policies";

describe("pass contract specifications", () => {
  it("keeps Reserved and Walk-in passes as different contracts", () => {
    const reserved: BoardingPassFixture = {
      kind: "RESERVED",
      bookingId: "booking-1",
      seatNumber: 5,
      guaranteesSeat: true,
    };
    const walkIn: BoardingPassFixture = {
      kind: "WALK_IN",
      intentId: "intent-1",
      guaranteesSeat: false,
    };

    assert.equal(reserved.kind, "RESERVED");
    assert.equal(reserved.guaranteesSeat, true);
    assert.equal(walkIn.kind, "WALK_IN");
    assert.equal(walkIn.guaranteesSeat, false);
    assert.equal("seatNumber" in walkIn, false);
  });
});

describe("location ingestion contract specifications", () => {
  it("retains source tagging while exposing one source-neutral consumer shape", () => {
    const base = {
      tripId: "trip-1",
      latitude: 3.215,
      longitude: 101.731,
      recordedAt: "2026-08-14T08:00:00.000Z",
    };
    const simulator: LocationInputFixture = {
      ...base,
      source: "SIMULATOR",
    };
    const gps: LocationInputFixture = { ...base, source: "GPS" };

    const storedSimulator = ingestLocation(simulator);
    const storedGps = ingestLocation(gps);
    const simulatorDto = toConsumerLocation(storedSimulator);
    const gpsDto = toConsumerLocation(storedGps);

    assert.equal(storedSimulator.source, "SIMULATOR");
    assert.equal(storedGps.source, "GPS");
    assert.deepEqual(Object.keys(simulatorDto), Object.keys(gpsDto));
    assert.deepEqual(simulatorDto.position, gpsDto.position);
    assert.equal(simulatorDto.prototype, true);
    assert.equal(gpsDto.prototype, false);
  });
});
