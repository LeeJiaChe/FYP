import { getUserFromToken } from "@/lib/auth";
import { listPublicRoutes } from "@/features/fleet/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    if (!(await getUserFromToken())) throw unauthenticated();
    return { body: { routes: await listPublicRoutes() } };
  });
}
