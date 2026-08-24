import { getUserFromToken } from "@/lib/auth";
import {
  joinJourneyWaitlist,
  joinWaitlistSchema,
  listMyReservations,
} from "@/features/bookings/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => ({
    body: { waitlist: (await listMyReservations(await actor())).waitlist },
  }));
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      success: true,
      waitlistEntry: await joinJourneyWaitlist(
        await actor(),
        await parseJsonBody(request, joinWaitlistSchema),
      ),
    },
    status: 201,
  }));
}
