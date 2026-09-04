import { getUserFromToken } from "@/lib/auth";
import { getStudentBookingEta } from "@/features/eta/server";
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
    const eta = await getStudentBookingEta(
      { userId: actor.userId, role: actor.role },
      id,
    );
    return { body: { eta } };
  });
}
