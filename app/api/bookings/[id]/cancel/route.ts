import { getUserFromToken } from "@/lib/auth";
import {
  bookingIdSchema,
  cancelReservedBooking,
} from "@/features/bookings/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/bookings/[id]/cancel">,
) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    const { id } = await context.params;
    const result = await cancelReservedBooking(
      { userId: user.userId, role: user.role },
      bookingIdSchema.parse(id),
    );
    return {
      body: {
        success: true,
        cancelledBookingId: result.bookingId,
        promotedCount: result.promoted.length,
      },
    };
  });
}
