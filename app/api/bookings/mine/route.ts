import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { studentId: user.userId },
      include: {
        trip: {
          include: {
            route: true,
            bus: true,
            driver: { select: { name: true } },
          },
        },
        seat: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = bookings.map((b) => ({
      id: b.id,
      status: b.status,
      seatNumber: b.seat?.seatNumber || null,
      seatId: b.seatId,
      waitlistPosition: b.waitlistPosition,
      checkedInAt: b.checkedInAt,
      checkInMethod: b.checkInMethod,
      qrTokenIssuedAt: b.qrTokenIssuedAt,
      createdAt: b.createdAt,
      trip: {
        id: b.trip.id,
        routeName: b.trip.route.name,
        routeStops: JSON.parse(b.trip.route.stops || "[]"),
        busPlateNumber: b.trip.bus.plateNumber,
        driverName: b.trip.driver?.name || "Unassigned",
        departureTime: b.trip.departureTime,
        estimatedArrivalTime: b.trip.estimatedArrivalTime,
        boardingDeadline: b.trip.boardingDeadline,
        status: b.trip.status,
      },
    }));

    return NextResponse.json({ bookings: formatted });
  } catch (err: any) {
    console.error("[bookings/mine] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
