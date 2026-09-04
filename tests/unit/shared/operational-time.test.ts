import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatMytDate,
  formatMytTime,
  getMytHour,
  mytServiceDayBounds,
  toMytServiceDateKey,
} from "../../../src/shared/time/operational-time";

describe("Malaysia operational time", () => {
  it("classifies both sides of MYT midnight on the correct service date", () => {
    assert.equal(toMytServiceDateKey("2026-09-04T15:59:59.999Z"), "2026-09-04");
    assert.equal(toMytServiceDateKey("2026-09-04T16:00:00.000Z"), "2026-09-05");
  });

  it("returns exact UTC boundaries for a MYT service day", () => {
    const bounds = mytServiceDayBounds("2026-09-05");
    assert.equal(bounds.startUtc.toISOString(), "2026-09-04T16:00:00.000Z");
    assert.equal(bounds.endUtcExclusive.toISOString(), "2026-09-05T16:00:00.000Z");
  });

  it("formats date and time independently of the host timezone", () => {
    const instant = "2026-09-04T16:05:00.000Z";
    assert.equal(formatMytTime(instant), "00:05");
    assert.equal(getMytHour(instant), 0);
    assert.match(formatMytDate(instant), /5 Sep/);
  });

  it("rejects impossible calendar dates", () => {
    assert.throws(() => mytServiceDayBounds("2026-02-30"), RangeError);
  });
});
