import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const penalties = await prisma.penalty.findMany({
      where: { studentId: user.id },
      include: {
        booking: {
          include: {
            trip: {
              include: { route: true, bus: true },
            },
          },
        },
        appeals: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = penalties.map((p) => ({
      id: p.id,
      creditPointsDeducted: p.creditPointsDeducted,
      reason: p.reason,
      status: p.status,
      createdAt: p.createdAt,
      booking: {
        id: p.booking.id,
        routeName: p.booking.trip.route.name,
        busPlateNumber: p.booking.trip.bus.plateNumber,
        departureTime: p.booking.trip.departureTime,
      },
      appeal: p.appeals[0] || null,
    }));

    return NextResponse.json({
      penalties: formatted,
      userCreditScore: user.creditScore,
      isBookingRestricted: user.isBookingRestricted,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch penalties" }, { status: 500 });
  }
}
