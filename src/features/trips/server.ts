import "server-only";

import {
  cancelTrip as cancelTripUseCase,
  updateScheduledTrip as updateScheduledTripUseCase,
} from "./application/schedule-trip";
import { notifyRealtime } from "@/lib/realtime-client";

export {
  cancelTripSchema,
  listTripsQuerySchema,
  scheduleTripSchema,
  tripIdSchema,
  updateScheduledTripSchema,
} from "./contracts/trip.schemas";
export {
  getTripDetail,
  listTrips,
  scheduleTrip,
} from "./application/schedule-trip";
export { cancelTripInTransaction } from "./infrastructure/trip.prisma.server";

export async function cancelTrip(...args: Parameters<typeof cancelTripUseCase>) {
  const result = await cancelTripUseCase(...args);
  await notifyRealtime(`trip:${result.trip.id}`, "trip.changed", {
    entityId: result.trip.id,
    changedAt: new Date().toISOString(),
    reason: "TRIP_CANCELLED",
  });
  return result;
}

export async function updateScheduledTrip(
  ...args: Parameters<typeof updateScheduledTripUseCase>
) {
  const result = await updateScheduledTripUseCase(...args);
  await notifyRealtime(`trip:${result.id}`, "trip.changed", {
    entityId: result.id,
    changedAt: new Date().toISOString(),
    reason: "TRIP_SCHEDULE_UPDATED",
  });
  return result;
}
