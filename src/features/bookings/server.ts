import "server-only";

import {
  cancelReservedBooking as cancelReservedBookingUseCase,
  createReservedBooking as createReservedBookingUseCase,
  joinJourneyWaitlist as joinJourneyWaitlistUseCase,
  releaseNoShowReservation as releaseNoShowReservationUseCase,
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
  await notifyRealtime(`trip:${booking.tripId}`, "seat-update", {
    tripId: booking.tripId,
    bookingId: booking.id,
    type: "RESERVED_JOURNEY_CONFIRMED",
  });
  return booking;
}

export async function joinJourneyWaitlist(
  ...args: Parameters<typeof joinJourneyWaitlistUseCase>
) {
  const entry = await joinJourneyWaitlistUseCase(...args);
  await notifyRealtime(`trip:${entry.tripId}`, "seat-update", {
    tripId: entry.tripId,
    waitlistEntryId: entry.id,
    type: "WAITLIST_JOINED",
  });
  return entry;
}

export async function cancelReservedBooking(
  ...args: Parameters<typeof cancelReservedBookingUseCase>
) {
  const result = await cancelReservedBookingUseCase(...args);
  await notifyRealtime(`trip:${result.tripId}`, "seat-update", {
    tripId: result.tripId,
    bookingId: result.bookingId,
    promotedCount: result.promoted.length,
    type: "RESERVED_JOURNEY_CANCELLED",
  });
  return result;
}

export async function releaseNoShowReservation(
  ...args: Parameters<typeof releaseNoShowReservationUseCase>
) {
  const result = await releaseNoShowReservationUseCase(...args);
  await notifyRealtime(`trip:${result.tripId}`, "seat-update", {
    tripId: result.tripId,
    promotedCount: result.promoted.length,
    type: "RESERVED_JOURNEY_RELEASED",
  });
  return result;
}
