import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";
import { getTripDetail, tripIdSchema } from "@/features/trips/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    const { id } = await params;
    return {
      body: {
        trip: await getTripDetail(
          { userId: user.userId, role: user.role },
          tripIdSchema.parse(id),
        ),
      },
    };
  });
}
