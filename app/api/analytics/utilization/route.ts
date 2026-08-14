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
            bus: true,
            seats: true,
          },
        },
      },
    });

    const routeUtilization = routes.map((route) => {
      let totalCapacity = 0;
      let totalOccupied = 0;

      route.trips.forEach((trip) => {
        totalCapacity += trip.seatedCapacity;
        const occupied = trip.seats.filter((s) => s.status === "RESERVED" || s.status === "CHECKED_IN" || s.status === "NO_SHOW").length;
        totalOccupied += occupied;
      });

      const utilizationRate = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

      return {
        routeName: route.name.split(":")[1]?.trim() || route.name,
        fullRouteName: route.name,
        totalTrips: route.trips.length,
        totalCapacity,
        totalOccupied,
        utilizationRate,
      };
    });

    // Simple rule-based suggestion (threshold check: utilization > 80%)
    const highDemandRoute = routeUtilization.find((r) => r.utilizationRate >= 75);
    const recommendation = highDemandRoute
      ? `High Demand Alert: "${highDemandRoute.routeName}" currently operates at ${highDemandRoute.utilizationRate}% average capacity. Rule-based recommendation: Add an additional trip slot during peak hours.`
      : "Fleet utilization levels are balanced across all operating routes.";

    return NextResponse.json({
      data: routeUtilization,
      recommendation,
    });
  } catch (err: any) {
    console.error("[analytics/utilization] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
