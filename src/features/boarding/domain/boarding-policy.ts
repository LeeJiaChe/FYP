import type { ProductPolicy } from "@/shared/config/policies";

export interface BoardingStopProgress {
  readonly plannedDeparture: Date;
  readonly actualArrival: Date | null;
  readonly actualDeparture: Date | null;
  readonly passedAt: Date | null;
}

export type BoardableTripStatus =
  | "NOT_STARTED"
  | "BOARDING"
  | "DEPARTED"
  | "ARRIVED"
  | "CANCELLED";

export type BoardingEligibility =
  | { readonly allowed: true; readonly delayedWindow: boolean }
  | {
      readonly allowed: false;
      readonly reason:
        | "TRIP_NOT_BOARDING"
        | "STOP_NOT_CURRENT"
        | "STOP_LEFT"
        | "TOO_EARLY"
        | "WINDOW_CLOSED";
    };

export function evaluateBoardingEligibility(
  now: Date,
  tripStatus: BoardableTripStatus,
  stop: BoardingStopProgress,
  policy: ProductPolicy,
): BoardingEligibility {
  if (tripStatus !== "BOARDING" && tripStatus !== "DEPARTED") {
    return { allowed: false, reason: "TRIP_NOT_BOARDING" };
  }
  if (stop.actualDeparture || stop.passedAt) {
    return { allowed: false, reason: "STOP_LEFT" };
  }
  if (!stop.actualArrival) {
    return { allowed: false, reason: "STOP_NOT_CURRENT" };
  }

  const opensAt = stop.plannedDeparture.getTime() - policy.boardingOpenLeadMs;
  if (now.getTime() < opensAt) {
    return { allowed: false, reason: "TOO_EARLY" };
  }
  const normallyClosesAt =
    stop.plannedDeparture.getTime() + policy.normalBoardingCloseGraceMs;
  if (now.getTime() <= normallyClosesAt) {
    return { allowed: true, delayedWindow: false };
  }

  // An arrived-but-not-departed TripStop is the durable evidence that the bus
  // is still boarding. This deliberately extends the scheduled close window.
  return { allowed: true, delayedWindow: true };
}

export function isWalkInIssuanceEligible(
  now: Date,
  tripStatus: BoardableTripStatus,
  stop: BoardingStopProgress,
  policy: ProductPolicy,
): boolean {
  if (stop.actualDeparture || stop.passedAt) return false;
  if (tripStatus === "ARRIVED" || tripStatus === "CANCELLED") return false;
  const opensAt = stop.plannedDeparture.getTime() - policy.bookingOpenLeadMs;
  if (now.getTime() < opensAt) return false;
  const normalClose =
    stop.plannedDeparture.getTime() + policy.normalBoardingCloseGraceMs;
  if (now.getTime() <= normalClose) return true;

  // Durable stop presence extends issuance during a real operational delay.
  // A stale, unprogressed Trip is not treated as an upcoming service.
  return (
    (tripStatus === "BOARDING" || tripStatus === "DEPARTED") &&
    stop.actualArrival !== null
  );
}
