import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { notifyRealtime } from "@/lib/realtime-client";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getUserFromToken();
    if (!currentUser || (currentUser.role !== "DRIVER" && currentUser.role !== "ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Driver or Admin access required." }, { status: 403 });
    }

    const { id: tripId } = await params;

    if (currentUser.role === "DRIVER") {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { driverId: true },
      });
      if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      if (trip.driverId !== currentUser.userId) {
        return NextResponse.json(
          { error: "You can only check in students on trips assigned to you" },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const { bookingId, seatId } = body;

    let targetBooking = null;

    if (bookingId) {
      targetBooking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { student: true },
      });
    } else if (seatId) {
      targetBooking = await prisma.booking.findFirst({
        where: { seatId, tripId },
        include: { student: true },
      });
    }

    if (!targetBooking) {
      return NextResponse.json({ error: "Booking or seat not found" }, { status: 404 });
    }

    if (targetBooking.status === "COMPLETED" || targetBooking.checkedInAt) {
      return NextResponse.json({ error: "Student is already checked in" }, { status: 400 });
    }

    // Execute transaction
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: targetBooking.id },
        data: {
          status: "COMPLETED",
          checkedInAt: new Date(),
          checkInMethod: "MANUAL",
        },
      });

      if (targetBooking.seatId) {
        await tx.seat.update({
          where: { id: targetBooking.seatId },
          data: { status: "CHECKED_IN" },
        });
      }
    });

    // Emit realtime event — fire-and-forget
    notifyRealtime(`trip:${tripId}`, "seat-update", {
      tripId,
      seatId: targetBooking.seatId,
      bookingId: targetBooking.id,
      studentName: targetBooking.student.name,
      seatStatus: "CHECKED_IN",
      bookingStatus: "COMPLETED",
      method: "MANUAL",
    });

    return NextResponse.json({
      success: true,
      message: `Manual check-in override successful for ${targetBooking.student.name}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to process manual check-in" }, { status: 500 });
  }
}
