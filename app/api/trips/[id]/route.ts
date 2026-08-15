import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";
import {
  cancelTrip,
  cancelTripSchema,
  getTripDetail,
  tripIdSchema,
  updateScheduledTrip,
  updateScheduledTripSchema,
} from "@/features/trips/server";

async function actor() {
  const user = await getUserFromToken();
  if (!user) throw unauthenticated();
  return { userId: user.userId, role: user.role };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const { id } = await params;
    return {
      body: {
        trip: await getTripDetail(
          await actor(),
          tripIdSchema.parse(id),
        ),
      },
    };
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const { id } = await params;
    return {
      body: {
        trip: await updateScheduledTrip(
          await actor(),
          tripIdSchema.parse(id),
          await parseJsonBody(request, updateScheduledTripSchema),
        ),
      },
    };
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const { id } = await params;
    return {
      body: await cancelTrip(
        await actor(),
        tripIdSchema.parse(id),
        await parseJsonBody(request, cancelTripSchema),
      ),
    };
  });
}
