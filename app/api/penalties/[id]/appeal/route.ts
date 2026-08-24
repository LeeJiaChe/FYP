import {
  penaltyIdSchema,
  submitPenaltyAppeal,
  submitPenaltyAppealSchema,
} from "@/features/penalties/server";
import { getUserFromToken } from "@/lib/auth";
import { unauthenticated } from "@/shared/application/application-error";
import {
  handleRoute,
  parseJsonBody,
} from "@/shared/http/handle-route.server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const actor = await getUserFromToken();
    if (!actor) throw unauthenticated();
    const penaltyId = penaltyIdSchema.parse((await context.params).id);
    const input = await parseJsonBody(request, submitPenaltyAppealSchema);
    return {
      status: 201,
      body: { appeal: await submitPenaltyAppeal(actor, penaltyId, input) },
    };
  });
}
