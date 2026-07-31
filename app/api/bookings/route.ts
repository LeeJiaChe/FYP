import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createBookingSchema } from "@/lib/validations";
import { notifyRealtime } from "@/lib/realtime-client";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized. Student role required." }, { status: 403 });
    }

    if (user.isBookingRestricted || user.creditScore < 40) {
      return NextResponse.json(
        { error: "Booking restricted due to low credit score (< 40 points). Please resolve active penalties." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tripId, seatId } = createBookingSchema.parse(body);

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { route: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Execute booking logic inside transaction
    const bookingResult = await prisma.$transaction(async (tx) => {
      // Check if student already has a confirmed or waitlisted booking on this trip inside transaction
      const existing = await tx.booking.findFirst({
        where: {
          studentId: user.id,
          tripId,
          status: { in: ["CONFIRMED", "WAITLISTED"] },
        },
      });

      if (existing) {
        throw new Error(`You already have a ${existing.status} booking for this trip`);
      }

      let targetSeat = null;

      if (seatId) {
        targetSeat = await tx.seat.findFirst({
          where: { id: seatId, tripId, status: "AVAILABLE" },
        });
      } else {
        targetSeat = await tx.seat.findFirst({
          where: { tripId, status: "AVAILABLE" },
          orderBy: { seatNumber: "asc" },
        });
      }

      if (targetSeat) {
        // Seat available -> RESERVE & CONFIRM
        await tx.seat.update({
          where: { id: targetSeat.id },
          data: { status: "RESERVED" },
        });

        const newBooking = await tx.booking.create({
          data: {
            studentId: user.id,
            tripId,
            seatId: targetSeat.id,
            status: "CONFIRMED",
          },
          include: { seat: true },
        });

        await tx.notification.create({
          data: {
            userId: user.id,
            type: "BOOKING_CONFIRMED",
            message: `Seat ${targetSeat.seatNumber} confirmed for ${trip.route.name} departing at ${new Date(trip.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          },
        });

        return { booking: newBooking, type: "CONFIRMED" };
      } else {
        // No available seat -> Join WAITLIST
        const maxWaitlist = await tx.booking.aggregate({
          where: { tripId, status: "WAITLISTED" },
          _max: { waitlistPosition: true },
        });

        const nextPosition = (maxWaitlist._max.waitlistPosition || 0) + 1;

        const waitlistBooking = await tx.booking.create({
          data: {
            studentId: user.id,
            tripId,
            seatId: null,
            status: "WAITLISTED",
            waitlistPosition: nextPosition,
          },
        });

        await tx.notification.create({
          data: {
            userId: user.id,
            type: "BOOKING_CONFIRMED",
            message: `You are #${nextPosition} on the waitlist for ${trip.route.name}`,
          },
        });

        return { booking: waitlistBooking, type: "WAITLISTED" };
      }
    });

    // Notify Realtime socket — fire-and-forget, don't block response
    notifyRealtime(`trip:${tripId}`, "seat-update", {
      tripId,
      bookingId: bookingResult.booking.id,
      seatId: bookingResult.booking.seatId,
      type: bookingResult.type,
    });

    return NextResponse.json({
      success: true,
      booking: bookingResult.booking,
      isWaitlisted: bookingResult.type === "WAITLISTED",
    });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to process booking" }, { status: 500 });
  }
}
