import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const routes = await prisma.route.findMany({
      include: {
        trips: {
          include: {
            bookings: true,
          },
        },
      },
    });

    const noShowStats = routes.map((route) => {
      let totalBookings = 0;
      let totalNoShows = 0;
      let totalCompleted = 0;

      route.trips.forEach((trip) => {
        trip.bookings.forEach((booking) => {
          if (booking.status !== "CANCELLED") {
            totalBookings++;
            if (booking.status === "NO_SHOW") totalNoShows++;
            if (booking.status === "COMPLETED") totalCompleted++;
          }
        });
      });

      const noShowRate = totalBookings > 0 ? Math.round((totalNoShows / totalBookings) * 100) : 0;

      return {
        routeName: route.name.split(":")[1]?.trim() || route.name,
        fullRouteName: route.name,
        totalBookings,
        totalNoShows,
        totalCompleted,
        noShowRate,
      };
    });

    return NextResponse.json({ data: noShowStats });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to compute no-show analytics" }, { status: 500 });
  }
}
