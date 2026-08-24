import { getUserFromToken } from "@/lib/auth";
import { analyticsRangeSchema, routeNoShowRates } from "@/features/analytics/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const url = new URL(request.url);
    const range = analyticsRangeSchema.parse({
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    return { body: { data: await routeNoShowRates({ role: actor.role }, range) } };
  });
}
