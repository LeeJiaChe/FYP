import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectBulkResourceConflicts,
  generateBulkTripCandidates,
  validateBulkServiceBlock,
} from "../../../src/features/trips/domain/bulk-schedule";

const base = {
  routeId: "00000000-0000-4000-8000-000000000001",
  serviceDateFrom: "2026-09-07",
  serviceDateTo: "2026-09-07",
  weekdays: [] as number[],
  startTime: "08:00",
  endTime: "09:00",
  headwayMinutes: 30,
  busIds: ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"],
  driverIds: ["00000000-0000-4000-8000-000000000004"],
};

describe("bulk timetable generation", () => {
  it("generates normal MYT departures and rotates resources", () => {
    const result = generateBulkTripCandidates(base);
    assert.deepEqual(result.map((item) => item.departureTime.toISOString()), [
      "2026-09-07T00:00:00.000Z",
      "2026-09-07T00:30:00.000Z",
      "2026-09-07T01:00:00.000Z",
    ]);
    assert.deepEqual(result.map((item) => item.busId), [base.busIds[0], base.busIds[1], base.busIds[0]]);
  });

  it("honours selected weekdays across a date range", () => {
    const result = generateBulkTripCandidates({
      ...base,
      serviceDateFrom: "2026-09-07",
      serviceDateTo: "2026-09-13",
      weekdays: [1, 3, 5],
      endTime: "08:00",
    });
    assert.equal(result.length, 3);
  });

  it("rejects a reversed daily time window", () => {
    assert.throws(() => generateBulkTripCandidates({ ...base, startTime: "10:00", endTime: "09:00" }), RangeError);
  });
});

describe("bulk scheduling preview failures", () => {
  const candidate = {
    busId: "bus-1",
    driverId: "driver-1",
    departureTime: new Date("2026-09-07T00:00:00Z"),
    estimatedArrivalTime: new Date("2026-09-07T01:00:00Z"),
  };

  it("detects independent Bus and Driver overlap conflicts", () => {
    assert.deepEqual(
      detectBulkResourceConflicts(candidate, [{ ...candidate, driverId: "driver-2" }]),
      ["BUS_SCHEDULE_CONFLICT"],
    );
    assert.deepEqual(
      detectBulkResourceConflicts(candidate, [{ ...candidate, busId: "bus-2" }]),
      ["DRIVER_SCHEDULE_CONFLICT"],
    );
  });

  it("detects missing, wrong-Bus and wrong-date ServiceBlocks", () => {
    assert.deepEqual(validateBulkServiceBlock(candidate, null, true), ["SERVICE_BLOCK_NOT_FOUND"]);
    assert.deepEqual(
      validateBulkServiceBlock(
        candidate,
        { busId: "bus-2", serviceDate: new Date("2026-09-08T00:00:00Z") },
        true,
      ),
      ["SERVICE_BLOCK_BUS_MISMATCH", "SERVICE_BLOCK_DATE_MISMATCH"],
    );
  });

  it("admits normal non-overlapping generation", () => {
    assert.deepEqual(detectBulkResourceConflicts(candidate, []), []);
    assert.deepEqual(validateBulkServiceBlock(candidate, null, false), []);
  });
});
