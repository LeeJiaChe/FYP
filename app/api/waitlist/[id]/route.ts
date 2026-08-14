import { getUserFromToken } from "@/lib/auth";
import {
  cancelJourneyWaitlistEntry,
  waitlistEntryIdSchema,
} from "@/features/bookings/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    const { id } = await context.params;
    return {
      body: {
        success: true,
        waitlistEntry: await cancelJourneyWaitlistEntry(
          { userId: user.userId, role: user.role },
          waitlistEntryIdSchema.parse(id),
        ),
      },
    };
  });
}
