import { getUserFromToken } from "@/lib/auth";
import { analyticsRangeSchema, routeUtilization } from "@/features/analytics/server";
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
    const data = await routeUtilization({ role: actor.role }, range);
    const highDemand = data.find((row) => row.seatedUtilizationRate >= 75);
    return {
      body: {
        data,
        recommendation: highDemand
          ? `High segment demand: ${highDemand.routeName} used ${highDemand.seatedUtilizationRate}% of available seated seat-segments in this period.`
          : "Segment-weighted seated utilization is below the configured review threshold.",
      },
    };
  });
}
