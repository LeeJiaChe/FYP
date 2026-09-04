import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyStudentJourney,
  isActiveBoardedJourney,
  selectStudentEtaBooking,
  shouldShowStudentJourneyEta,
  type StudentJourneyBooking,
} from "../../../src/features/bookings/ui/student-journey-presentation";

const nowMs = Date.parse("2026-09-04T10:00:00.000Z");

function booking(
  overrides: Partial<StudentJourneyBooking> & { id: string },
): StudentJourneyBooking & { id: string } {
  const { id, trip, ...bookingOverrides } = overrides;
  return {
    id,
    status: "CONFIRMED",
    checkedInAt: null,
    actualAlightedAt: null,
    trip: {
      departureTime: "2026-09-04T10:30:00.000Z",
      status: "NOT_STARTED",
      ...trip,
    },
    ...bookingOverrides,
  };
}

describe("student journey ETA presentation", () => {
  it("keeps the next future confirmed reservation operational", () => {
    const future = booking({ id: "future" });
    assert.equal(classifyStudentJourney(future, nowMs), "UPCOMING");
    assert.equal(shouldShowStudentJourneyEta(future, nowMs), true);
  });

  it("keeps a boarded journey active after scheduled departure", () => {
    const boarded = booking({
      id: "boarded",
      checkedInAt: "2026-09-04T09:55:00.000Z",
      trip: {
        departureTime: "2026-09-04T09:50:00.000Z",
        status: "DEPARTED",
      },
    });

    assert.equal(isActiveBoardedJourney(boarded), true);
    assert.equal(classifyStudentJourney(boarded, nowMs), "ACTIVE_BOARDED");
    assert.equal(shouldShowStudentJourneyEta(boarded, nowMs), true);
  });

  it("returns alighted, cancelled and no-show journeys to past presentation", () => {
    const alighted = booking({
      id: "alighted",
      checkedInAt: "2026-09-04T09:45:00.000Z",
      actualAlightedAt: "2026-09-04T10:05:00.000Z",
      trip: {
        departureTime: "2026-09-04T09:50:00.000Z",
        status: "DEPARTED",
      },
    });
    const cancelled = booking({ id: "cancelled", status: "CANCELLED" });
    const noShow = booking({ id: "no-show", status: "NO_SHOW" });

    for (const journey of [alighted, cancelled, noShow]) {
      assert.equal(classifyStudentJourney(journey, nowMs), "PAST");
      assert.equal(shouldShowStudentJourneyEta(journey, nowMs), false);
    }
  });

  it("does not keep a boarded journey active after its Trip is terminal", () => {
    for (const tripStatus of ["ARRIVED", "CANCELLED"]) {
      const terminal = booking({
        id: tripStatus,
        checkedInAt: "2026-09-04T09:45:00.000Z",
        trip: {
          departureTime: "2026-09-04T09:50:00.000Z",
          status: tripStatus,
        },
      });
      assert.equal(classifyStudentJourney(terminal, nowMs), "PAST");
      assert.equal(shouldShowStudentJourneyEta(terminal, nowMs), false);
    }
  });

  it("prioritizes the current boarded journey over the next future journey", () => {
    const future = booking({ id: "future" });
    const boarded = booking({
      id: "boarded",
      checkedInAt: "2026-09-04T09:45:00.000Z",
      trip: {
        departureTime: "2026-09-04T09:50:00.000Z",
        status: "DEPARTED",
      },
    });

    assert.equal(selectStudentEtaBooking([future, boarded], nowMs)?.id, "boarded");
  });
});
