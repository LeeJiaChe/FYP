import { getUserFromToken } from "@/lib/auth";
import { listMyReservations } from "@/features/bookings/server";
import { unauthenticated } from "@/shared/application/application-error";
import { handleRoute } from "@/shared/http/handle-route.server";

export async function GET(request: Request) {
  return handleRoute(request, async () => {
    const user = await getUserFromToken();
    if (!user) throw unauthenticated();
    return {
      body: await listMyReservations({ userId: user.userId, role: user.role }),
    };
  });
}
