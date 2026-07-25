import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { notifyRealtime } from "@/lib/realtime-client";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: bookingId } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trip: { include: { route: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.studentId !== user.userId && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized to cancel this booking" }, { status: 403 });
    }

    if (booking.status === "CANCELLED" || booking.status === "COMPLETED" || booking.status === "NO_SHOW") {
      return NextResponse.json({ error: `Cannot cancel booking with status ${booking.status}` }, { status: 400 });
    }

    const tripId = booking.tripId;
    const freedSeatId = booking.seatId;

    // Execute cancellation & waitlist promotion in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cancel target booking
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          seatId: null,
          waitlistPosition: null,
        },
      });

      let promotedStudentId = null;

      // 2. If seat was released, promote top waitlisted booking
      if (freedSeatId) {
        const topWaitlisted = await tx.booking.findFirst({
          where: { tripId, status: "WAITLISTED" },
          orderBy: { waitlistPosition: "asc" },
        });

        if (topWaitlisted) {
          // Assign seat to waitlisted student
          await tx.booking.update({
            where: { id: topWaitlisted.id },
            data: {
              status: "CONFIRMED",
              seatId: freedSeatId,
              waitlistPosition: null,
            },
          });

          await tx.seat.update({
            where: { id: freedSeatId },
            data: { status: "RESERVED" },
          });

          promotedStudentId = topWaitlisted.studentId;

          // Send notification to promoted student
          await tx.notification.create({
            data: {
              userId: topWaitlisted.studentId,
              type: "WAITLIST_PROMOTED",
              message: `Great news! You have been promoted from the waitlist for ${booking.trip.route.name}. Your seat is confirmed!`,
            },
          });

          // Re-order remaining waitlist positions
          const remainingWaitlist = await tx.booking.findMany({
            where: { tripId, status: "WAITLISTED" },
            orderBy: { waitlistPosition: "asc" },
          });

          for (let index = 0; index < remainingWaitlist.length; index++) {
            await tx.booking.update({
              where: { id: remainingWaitlist[index].id },
              data: { waitlistPosition: index + 1 },
            });
          }
        } else {
          // No waitlisted student -> seat becomes AVAILABLE
          await tx.seat.update({
            where: { id: freedSeatId },
            data: { status: "AVAILABLE" },
          });
        }
      }

      return { promotedStudentId };
    });

    // Notify Realtime socket — fire-and-forget
    notifyRealtime(`trip:${tripId}`, "seat-update", {
      tripId,
      cancelledBookingId: bookingId,
      freedSeatId,
      promotedStudentId: result.promotedStudentId,
    });

    return NextResponse.json({
      success: true,
      message: "Booking cancelled successfully",
      wasWaitlistPromoted: !!result.promotedStudentId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to cancel booking" }, { status: 500 });
  }
}
