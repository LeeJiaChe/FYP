import { findSubscriptionTrip } from "../infrastructure/subscription.prisma.server";
import { signRealtimeSubscription } from "../infrastructure/subscription-token.server";
import { forbidden, notFound } from "@/shared/application/application-error";

export interface RealtimeActor {
  readonly userId: string;
  readonly role: "STUDENT" | "DRIVER" | "ADMIN";
}

export async function issueTripSubscription(actor: RealtimeActor, tripId: string) {
  const trip = await findSubscriptionTrip(tripId);
  if (!trip) throw notFound("Trip not found");
  if (trip.status === "CANCELLED") throw forbidden("Cancelled Trip is not subscribable");
  if (actor.role === "DRIVER" && trip.driverId !== actor.userId) {
    throw forbidden("Driver may subscribe only to an assigned Trip");
  }
  const signed = signRealtimeSubscription({
    purpose: "REALTIME_SUBSCRIPTION",
    userId: actor.userId,
    role: actor.role,
    tripId,
  });
  return { ...signed, room: `trip:${tripId}` };
}

