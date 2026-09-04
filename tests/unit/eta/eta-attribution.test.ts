import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidElement } from "react";

import { GoogleMapsAttribution } from "../../../src/features/eta/ui/GoogleMapsAttribution";
import {
  adminStopPresentation,
  etaSourceDisclosure,
  etaSourceLabel,
  formatShuttleTime,
  terminalTripMessage,
} from "../../../src/features/eta/ui/eta-display";
import { minutesUntil } from "../../../src/features/eta/ui/useEtaDisplayClock";
import type { StopEta } from "../../../src/features/eta/contracts/eta.schemas";

function stopEstimate(stopCode: string, position: number): StopEta {
  return {
    tripStopId: `00000000-0000-4000-8000-00000000000${position}`,
    stopCode,
    stopName: stopCode,
    position,
    plannedArrival: "2026-09-04T00:10:00.000Z",
    estimatedArrival: "2026-09-04T00:12:00.000Z",
    minutesAway: 12,
    scheduleVarianceMinutes: 2,
    cumulativeDistanceMeters: 1_000,
  };
}

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

  it("separates traffic estimate source from telemetry diagnostics", () => {
    assert.equal(
      etaSourceDisclosure("TRAFFIC_AWARE", "SIMULATED", null),
      "Based on simulated shuttle location",
    );
    assert.equal(
      etaSourceDisclosure("TRAFFIC_AWARE", "GPS", null),
      "Live GPS telemetry",
    );

    const staleSchedule = etaSourceDisclosure(
      "SCHEDULE_ESTIMATE",
      "SIMULATED",
      "STALE_LOCATION",
    );
    const failedSchedule = etaSourceDisclosure(
      "SCHEDULE_ESTIMATE",
      "SIMULATED",
      "API_ERROR",
    );
    assert.equal(staleSchedule, "Schedule estimate · location outdated");
    assert.equal(
      failedSchedule,
      "Schedule estimate · traffic service unavailable",
    );
    assert.doesNotMatch(staleSchedule, /Based on simulated shuttle location/);
    assert.doesNotMatch(failedSchedule, /Based on simulated shuttle location/);
  });

  it("uses human-readable schedule fallback labels", () => {
    assert.equal(
      etaSourceLabel("SCHEDULE_ESTIMATE", "NO_LOCATION"),
      "Schedule estimate · location unavailable",
    );
    assert.equal(
      etaSourceLabel("SCHEDULE_ESTIMATE", "NO_ROUTE"),
      "Schedule estimate · traffic route unavailable",
    );
    assert.equal(
      etaSourceLabel("SCHEDULE_ESTIMATE", "API_TIMEOUT"),
      "Schedule estimate · traffic service timed out",
    );
    assert.equal(
      etaSourceLabel("SCHEDULE_ESTIMATE", "INVALID_ROUTE_DATA"),
      "Schedule estimate · route data unavailable",
    );
  });

  it("selects consistent next and final stops for admin ETA cards", () => {
    const stops = [
      stopEstimate("S1", 1),
      stopEstimate("S2", 2),
      stopEstimate("S3", 3),
    ];
    const multiple = adminStopPresentation(stops, "DEPARTED");
    assert.equal(multiple.nextStop, stops[0]);
    assert.equal(multiple.finalStop, stops[2]);

    const onlyStop = adminStopPresentation([stops[2]], "DEPARTED");
    assert.equal(onlyStop.nextStop, stops[2]);
    assert.equal(onlyStop.finalStop, stops[2]);
    assert.equal(onlyStop.noRemainingStopsMessage, null);
    assert.equal(terminalTripMessage("DEPARTED"), null);
  });

  it("does not infer arrival from an active Trip with no remaining ETA", () => {
    const noStops = adminStopPresentation([], "DEPARTED");
    assert.equal(noStops.nextStop, null);
    assert.equal(noStops.finalStop, null);
    assert.equal(
      noStops.noRemainingStopsMessage,
      "At final stop · awaiting trip completion",
    );
    assert.doesNotMatch(noStops.noRemainingStopsMessage, /Arrived/i);
    assert.equal(terminalTripMessage("ARRIVED"), "Trip completed");
  });

  it("formats ETA clock labels in Malaysia time", () => {
    assert.equal(formatShuttleTime("2026-09-04T00:00:00.000Z"), "08:00");
  });
});
