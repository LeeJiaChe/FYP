import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { projectTripSeatForActor } from "../../../src/features/trips/domain/trip-seat-projection";

function claim(studentId: string, name: string) {
  return {
    tripSeatId: "seat-1",
    booking: {
      id: `booking-${studentId}`,
      studentId,
      status: "CONFIRMED",
      checkedInAt: null as Date | null,
      checkInMethod: null as string | null,
      student: { name, studentId: `ID-${studentId}` },
      boardingTripStop: { stopName: "Stop A" },
      dropOffTripStop: { stopName: "Stop B" },
    },
  };
}

describe("role-specific Trip seat projection", () => {
  it("never projects another student's identity through the current claim", () => {
    const other = claim("other", "Other Passenger");
    const projected = projectTripSeatForActor({
      actor: { userId: "viewer", role: "STUDENT" },
      seat: { id: "seat-1", seatNumber: 1 },
      currentClaim: other,
      seatClaims: [other],
    });
    assert.equal(projected.status, "UNAVAILABLE");
    assert.equal(projected.booking, null);
    assert.deepEqual(projected.journeys, []);
    assert.equal(JSON.stringify(projected).includes("Other Passenger"), false);
    assert.equal(JSON.stringify(projected).includes("ID-other"), false);
  });

  it("does not reveal another passenger's check-in state", () => {
    const other = claim("other", "Other Passenger");
    other.booking.checkedInAt = new Date("2026-09-04T01:00:00Z");
    other.booking.checkInMethod = "QR";
    const projected = projectTripSeatForActor({
      actor: { userId: "viewer", role: "STUDENT" },
      seat: { id: "seat-1", seatNumber: 1 },
      currentClaim: other,
      seatClaims: [other],
    });
    assert.equal(projected.status, "UNAVAILABLE");
    assert.equal(JSON.stringify(projected).includes("QR"), false);
  });

  it("allows a student to identify only their own reservation", () => {
    const own = claim("viewer", "Viewer Name");
    const other = claim("other", "Other Passenger");
    const projected = projectTripSeatForActor({
      actor: { userId: "viewer", role: "STUDENT" },
      seat: { id: "seat-1", seatNumber: 1 },
      currentClaim: other,
      seatClaims: [other, own],
    });
    assert.equal(projected.booking?.id, "booking-viewer");
    assert.equal(projected.booking?.studentName, "Viewer Name");
    assert.equal(projected.journeys.length, 1);
    assert.equal(JSON.stringify(projected).includes("Other Passenger"), false);
  });

  it("preserves operational identity for an authorized driver or admin", () => {
    const other = claim("other", "Other Passenger");
    for (const role of ["DRIVER", "ADMIN"]) {
      const projected = projectTripSeatForActor({
        actor: { userId: "operator", role },
        seat: { id: "seat-1", seatNumber: 1 },
        currentClaim: other,
        seatClaims: [other],
      });
      assert.equal(projected.booking?.studentName, "Other Passenger");
    }
  });
});
