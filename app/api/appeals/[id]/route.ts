import {
  appealIdSchema,
  resolvePenaltyAppeal,
  resolvePenaltyAppealSchema,
} from "@/features/penalties/server";
import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import {
  handleRoute,
  parseJsonBody,
} from "@/shared/http/handle-route.server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const appealId = appealIdSchema.parse((await context.params).id);
    const input = await parseJsonBody(request, resolvePenaltyAppealSchema);
    return {
      body: { result: await resolvePenaltyAppeal(actor, appealId, input) },
    };
  });
}
