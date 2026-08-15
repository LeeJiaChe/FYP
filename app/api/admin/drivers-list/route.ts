import { getUserFromToken } from "@/lib/auth";
import { listDrivers } from "@/features/identity/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    return { body: { drivers: await listDrivers({ userId: actor.userId, role: actor.role }) } };
  });
}
