import { z } from "zod";

import { uuidSchema } from "@/shared/types/uuid";

export const journeySelectionSchema = z.object({
  tripId: uuidSchema,
  boardingTripStopId: uuidSchema,
  dropOffTripStopId: uuidSchema,
});

export const journeyAvailabilityQuerySchema = journeySelectionSchema;

export const createReservedBookingSchema = journeySelectionSchema.extend({
  tripSeatId: uuidSchema,
});

export const joinWaitlistSchema = journeySelectionSchema;

export const bookingIdSchema = uuidSchema;
export const waitlistEntryIdSchema = uuidSchema;

export type JourneySelection = z.infer<typeof journeySelectionSchema>;
export type CreateReservedBookingInput = z.infer<
  typeof createReservedBookingSchema
>;
export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
