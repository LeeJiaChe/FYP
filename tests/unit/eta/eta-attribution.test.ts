import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidElement } from "react";

import { GoogleMapsAttribution } from "../../../src/features/eta/ui/GoogleMapsAttribution";
import { minutesUntil } from "../../../src/features/eta/ui/useEtaDisplayClock";

describe("ETA client display helpers", () => {
  it("renders compliant attribution only for Google traffic content", () => {
    const trafficAttribution = GoogleMapsAttribution({ source: "TRAFFIC_AWARE" });
    const scheduleAttribution = GoogleMapsAttribution({ source: "SCHEDULE_ESTIMATE" });

    assert.ok(isValidElement(trafficAttribution));
    const props = trafficAttribution.props as {
      children: string;
      translate: string;
    };
    assert.equal(props.children, "Google Maps");
    assert.equal(props.translate, "no");
    assert.doesNotMatch(props.children, /Powered by Google Routes|Google Routes/);
    assert.equal(scheduleAttribution, null);
  });

  it("counts down locally from the authoritative estimated arrival", () => {
    const estimatedArrival = "2026-09-04T10:20:00.000Z";
    assert.equal(minutesUntil(estimatedArrival, Date.parse("2026-09-04T10:13:00.000Z")), 7);
    assert.equal(minutesUntil(estimatedArrival, Date.parse("2026-09-04T10:14:00.000Z")), 6);
  });
});
