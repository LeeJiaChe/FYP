import { getUserFromToken } from "@/lib/auth";
import {
  getOperationsIntelligence,
  operationsAnalyticsQuerySchema,
} from "@/features/analytics/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const url = new URL(request.url);
    const query = operationsAnalyticsQuerySchema.parse({
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      lineId: url.searchParams.get("lineId") || undefined,
      direction: url.searchParams.get("direction") || undefined,
    });
    return {
      body: {
        data: await getOperationsIntelligence({ role: actor.role }, query),
      },
    };
  });
}
