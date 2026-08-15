import "server-only";

import {
  boardManually as boardManuallyUseCase,
  boardWithPass as boardWithPassUseCase,
  confirmAlighting as confirmAlightingUseCase,
  progressTrip as progressTripUseCase,
} from "./application/boarding";
import { notifyRealtime } from "@/lib/realtime-client";
import { issueSignedPass } from "./infrastructure/pass-token.server";

export {
  getDriverManifest,
  issueAlightingPass,
  issueReservedBoardingPass,
} from "./application/boarding";
export {
  alightingPassSchema,
  alightingSchema,
  manualBoardingSchema,
  passTokenSchema,
  tripIdSchema,
  tripProgressSchema,
} from "./contracts/boarding.schemas";

export const issueBoardingPass = issueSignedPass;

async function publishTrip(result: { tripId: string }, type: string) {
  await notifyRealtime(`trip:${result.tripId}`, "occupancy.changed", {
    entityId: result.tripId,
    changedAt: new Date().toISOString(),
    reason: type,
  });
}

export async function boardWithPass(
  ...args: Parameters<typeof boardWithPassUseCase>
) {
  const result = await boardWithPassUseCase(...args);
  await publishTrip(result, `BOARDING_${result.outcome}`);
  return result;
}

export async function boardManually(
  ...args: Parameters<typeof boardManuallyUseCase>
) {
  const result = await boardManuallyUseCase(...args);
  await publishTrip(result, `BOARDING_${result.outcome}`);
  return result;
}

export async function confirmAlighting(
  ...args: Parameters<typeof confirmAlightingUseCase>
) {
  const result = await confirmAlightingUseCase(...args);
  await publishTrip(result, `ALIGHTING_${result.outcome}`);
  return result;
}

export async function progressTrip(
  ...args: Parameters<typeof progressTripUseCase>
) {
  const result = await progressTripUseCase(...args);
  await notifyRealtime(`trip:${result.trip.id}`, "trip.changed", {
    entityId: result.trip.id,
    changedAt: new Date().toISOString(),
    reason: "TRIP_PROGRESS_CHANGED",
  });
  return result;
}
