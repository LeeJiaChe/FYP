import "server-only";

import {
  cancelReservedBooking as cancelReservedBookingUseCase,
  createReservedBooking as createReservedBookingUseCase,
  joinJourneyWaitlist as joinJourneyWaitlistUseCase,
} from "./application/reservations";
import { notifyRealtime } from "@/lib/realtime-client";

export {
  bookingIdSchema,
  createReservedBookingSchema,
  joinWaitlistSchema,
  journeyAvailabilityQuerySchema,
  waitlistEntryIdSchema,
} from "./contracts/booking.schemas";
export {
  cancelJourneyWaitlistEntry,
  findJourneyAvailability,
  listMyReservations,
} from "./application/reservations";

export async function createReservedBooking(
  ...args: Parameters<typeof createReservedBookingUseCase>
) {
  const booking = await createReservedBookingUseCase(...args);
  await notifyRealtime(`trip:${booking.tripId}`, "occupancy.changed", {
    entityId: booking.tripId,
    changedAt: new Date().toISOString(),
    reason: "RESERVATION_CONFIRMED",
  });
  return booking;
}

export async function joinJourneyWaitlist(
  ...args: Parameters<typeof joinJourneyWaitlistUseCase>
) {
  const entry = await joinJourneyWaitlistUseCase(...args);
  await notifyRealtime(`trip:${entry.tripId}`, "occupancy.changed", {
    entityId: entry.tripId,
    changedAt: new Date().toISOString(),
    reason: "WAITLIST_CHANGED",
  });
  return entry;
}

export async function cancelReservedBooking(
  ...args: Parameters<typeof cancelReservedBookingUseCase>
) {
  const result = await cancelReservedBookingUseCase(...args);
  await notifyRealtime(`trip:${result.tripId}`, "occupancy.changed", {
    entityId: result.tripId,
    changedAt: new Date().toISOString(),
    reason: "RESERVATION_CANCELLED",
  });
  return result;
}

export { promoteCompatibleWaitlistInTransaction } from "./infrastructure/booking.prisma.server";
