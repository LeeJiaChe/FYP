import { getUserFromToken } from "@/lib/auth";
import {
  issueTripSubscription,
  realtimeSubscriptionSchema,
} from "@/features/realtime/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const input = await parseJsonBody(request, realtimeSubscriptionSchema, 1_024);
    return {
      body: await issueTripSubscription(
        { userId: actor.userId, role: actor.role },
        input.tripId,
      ),
    };
  });
}
