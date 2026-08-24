import { getUserFromToken } from "@/lib/auth";
import {
  createReservedBooking,
  createReservedBookingSchema,
} from "@/features/bookings/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute, parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    const booking = await createReservedBooking(
      { userId: user.userId, role: user.role },
      await parseJsonBody(request, createReservedBookingSchema),
    );
    return { body: { success: true, booking }, status: 201 };
  });
}
