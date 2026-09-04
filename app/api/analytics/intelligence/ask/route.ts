import { getUserFromToken } from "@/lib/auth";
import {
  askIntelligenceInputSchema,
  askOperationsIntelligence,
} from "@/features/analytics/server";
import { askIntelligenceRateLimiter } from "@/lib/rate-limit";
import {
  unauthenticated,
  validationError,
} from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!askIntelligenceRateLimiter.check(`${actor.userId}:${ip}`)) {
      throw validationError("Ask Operations Intelligence rate limit reached");
    }
    const input = askIntelligenceInputSchema.parse(await request.json());
    return {
      body: {
        answer: await askOperationsIntelligence(
          { role: actor.role },
          input,
        ),
      },
    };
  });
}
