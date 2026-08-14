import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";
import { alightingPassSchema, issueAlightingPass } from "@/features/boarding/server";

export async function POST(request: Request) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    return {
      body: await issueAlightingPass(
        { userId: user.userId, role: user.role },
        await parseJsonBody(request, alightingPassSchema),
      ),
    };
  });
}
