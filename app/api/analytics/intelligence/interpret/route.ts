import { getUserFromToken } from "@/lib/auth";
import { interpretIntelligenceRateLimiter } from "@/lib/rate-limit";
import {
  interpretIntelligenceInputSchema,
  interpretOperationsIntelligence,
} from "@/features/analytics/server";
import {
  unauthenticated,
  validationError,
} from "@/shared/application/application-error";
import {
  handleRoute,
  parseJsonBody,
} from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!interpretIntelligenceRateLimiter.check(`${actor.userId}:${ip}`)) {
      throw validationError("Operations interpretation rate limit reached");
    }
    const input = await parseJsonBody(request, interpretIntelligenceInputSchema);
    return {
      body: {
        data: await interpretOperationsIntelligence(
          { role: actor.role },
          input,
        ),
      },
    };
  });
}
