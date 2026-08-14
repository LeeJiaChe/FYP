import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyQRToken } from "@/lib/qr";
import { notifyRealtime } from "@/lib/realtime-client";
import { getUserFromToken } from "@/lib/auth";

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
          { error: "You can only scan QR codes for trips assigned to you" },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "QR Token is required" }, { status: 400 });
    }

    const verification = verifyQRToken(token);
    if (!verification.valid || !verification.payload) {
      return NextResponse.json({ error: verification.error || "Invalid QR token" }, { status: 400 });
    }

    const {
      bookingId,
      tripId: tokenTripId,
      tripSeatId,
      boardingTripStopId,
      dropOffTripStopId,
      passType,
    } = verification.payload;

    if (tokenTripId !== tripId) {
      return NextResponse.json({ error: "QR code belongs to a different trip" }, { status: 400 });
    }

    if (passType !== "RESERVED") {
      return NextResponse.json({ error: "Expected a Reserved Pass" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tripSeat: { include: { legacySeat: true } }, student: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking record not found" }, { status: 404 });
    }

    if (
      booking.tripId !== tripId ||
      booking.tripSeatId !== tripSeatId ||
      booking.boardingTripStopId !== boardingTripStopId ||
      booking.dropOffTripStopId !== dropOffTripStopId
    ) {
      return NextResponse.json({ error: "Reserved Pass journey does not match Booking" }, { status: 400 });
    }

    if (booking.status === "COMPLETED" || booking.checkedInAt) {
      return NextResponse.json({ error: "Already checked in" }, { status: 400 });
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: `Cannot check in. Booking status is ${booking.status}` }, { status: 400 });
    }

    // Execute check-in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          checkedInAt: new Date(),
          checkInMethod: "QR",
        },
      });

      if (booking.tripSeat.legacySeat) {
        await tx.seat.update({
          where: { id: booking.tripSeat.legacySeat.id },
          data: { status: "CHECKED_IN" },
        });
      }

      return updatedBooking;
    });

    // Notify Socket.io room — fire-and-forget
    notifyRealtime(`trip:${tripId}`, "seat-update", {
      tripId,
      tripSeatId: booking.tripSeatId,
      bookingId,
      studentName: booking.student.name,
      seatStatus: "CHECKED_IN",
      bookingStatus: "COMPLETED",
    });

    return NextResponse.json({
      success: true,
      message: `Checked in successfully: ${booking.student.name}`,
      student: {
        id: booking.student.id,
        name: booking.student.name,
        studentId: booking.student.studentId,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to process scan" }, { status: 500 });
  }
}
