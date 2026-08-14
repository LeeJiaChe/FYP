import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";
import {
  progressTrip,
  tripIdSchema,
  tripProgressSchema,
} from "@/features/boarding/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    const { id } = await params;
    return {
      body: await progressTrip(
        { userId: user.userId, role: user.role },
        tripIdSchema.parse(id),
        await parseJsonBody(request, tripProgressSchema),
      ),
    };
  });
}
