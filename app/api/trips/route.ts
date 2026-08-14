import { getUserFromToken } from "@/lib/auth";
import {
  listTrips,
  listTripsQuerySchema,
  scheduleTrip,
  scheduleTripSchema,
} from "@/features/trips/server";
import { unauthenticated } from "@/shared/application/application-error";
import {
  handleRoute,
  parseJsonBody,
} from "@/shared/http/handle-route.server";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    const url = new URL(request.url);
    const query = listTripsQuerySchema.parse({
      routeId: url.searchParams.get("routeId") || undefined,
      driverId: url.searchParams.get("driverId") || undefined,
      date: url.searchParams.get("date") || undefined,
    });
    return { body: { trips: await listTrips(await actor(), query) } };
  });
}

export async function POST(request: Request) {
  return handleRoute(request, async () => ({
    body: {
      success: true,
      trip: await scheduleTrip(
        await actor(),
        await parseJsonBody(request, scheduleTripSchema),
      ),
    },
    status: 201,
  }));
}
