import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const appeals = await prisma.penaltyAppeal.findMany({
      include: {
        student: { select: { id: true, name: true, studentId: true, email: true } },
        penalty: {
          include: {
            booking: {
              include: {
                trip: {
                  include: { route: true, bus: true },
                },
              },
            },
          },
        },
        reviewedByAdmin: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = appeals.map((a) => ({
      id: a.id,
      penaltyId: a.penaltyId,
      studentName: a.student.name,
      studentId: a.student.studentId,
      studentEmail: a.student.email,
      creditPointsDeducted: a.penalty.creditPointsDeducted,
      penaltyReason: a.penalty.reason,
      appealReason: a.reason,
      status: a.status,
      adminComment: a.adminComment,
      reviewedBy: a.reviewedByAdmin?.name || null,
      createdAt: a.createdAt,
      resolvedAt: a.resolvedAt,
      tripRouteName: a.penalty.booking.trip.route.name,
      tripDeparture: a.penalty.booking.trip.departureTime,
    }));

    return NextResponse.json({ appeals: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch appeals" }, { status: 500 });
  }
}
