import { getUserFromToken } from "@/lib/auth";
import { getDriverOperation } from "@/features/trips/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    return {
      body: await getDriverOperation({ userId: user.userId, role: user.role }),
    };
  });
}
