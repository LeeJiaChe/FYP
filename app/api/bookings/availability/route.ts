import { getUserFromToken } from "@/lib/auth";
import {
  findJourneyAvailability,
  journeyAvailabilityQuerySchema,
} from "@/features/bookings/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    const search = new URL(request.url).searchParams;
    const query = journeyAvailabilityQuerySchema.parse({
      tripId: search.get("tripId"),
      boardingTripStopId: search.get("boardingTripStopId"),
      dropOffTripStopId: search.get("dropOffTripStopId"),
    });
    return {
      body: {
        availability: await findJourneyAvailability(
          { userId: user.userId, role: user.role },
          query,
        ),
      },
    };
  });
}
