import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";
import { issueWalkInPass, walkInIntentIdSchema } from "@/features/walk-ins/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    const { id } = await params;
    return {
      body: await issueWalkInPass(
        { userId: user.userId, role: user.role },
        walkInIntentIdSchema.parse(id),
      ),
    };
  });
}
