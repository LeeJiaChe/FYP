import { getUserFromToken } from "@/lib/auth";
import { bulkScheduleSchema, previewBulkSchedule } from "@/features/trips/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    return {
      body: {
        preview: await previewBulkSchedule(
          { userId: user.userId, role: user.role },
          await parseJsonBody(request, bulkScheduleSchema),
        ),
      },
    };
  });
}
