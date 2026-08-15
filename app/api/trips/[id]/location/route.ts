import { getUserFromToken } from "@/lib/auth";
import {
  latestLocation,
  locationTripIdSchema,
} from "@/features/location/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const { id } = await params;
    return { body: { location: await latestLocation(locationTripIdSchema.parse(id)) } };
  });
}
