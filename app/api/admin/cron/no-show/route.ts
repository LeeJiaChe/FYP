import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRealtime } from "@/lib/realtime-client";

export async function POST(req: Request) {
  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.REALTIME_SERVICE_SECRET || "fyp-realtime-secret-key";

    if (cronSecret !== expectedSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized cron call" }, { status: 401 });
    }

    const now = new Date();

    // 1. Find trips past boarding deadline that are not DEPARTED or CANCELLED
    const expiredTrips = await prisma.trip.findMany({
      where: {
        boardingDeadline: { lt: now },
        status: { notIn: ["DEPARTED", "CANCELLED", "ARRIVED"] },
      },
      include: {
        bookings: {
          where: { status: "CONFIRMED", checkedInAt: null },
          include: { student: true, seat: true },
        },
      },
    });

    let totalNoShowsProcessed = 0;

    for (const trip of expiredTrips) {
      for (const booking of trip.bookings) {
        await prisma.$transaction(async (tx) => {
          // Mark booking and seat as NO_SHOW
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: "NO_SHOW" },
          });

          if (booking.seatId) {
            await tx.seat.update({
              where: { id: booking.seatId },
              data: { status: "NO_SHOW" },
            });
          }

          // Create Penalty record
          const penaltyDeduction = 15;
          const penalty = await tx.penalty.create({
            data: {
              bookingId: booking.id,
              studentId: booking.studentId,
              creditPointsDeducted: penaltyDeduction,
              reason: `No-show on Trip (${trip.id.slice(0, 8)}) departing at ${new Date(trip.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
              status: "ACTIVE",
            },
          });

          // Fetch latest user record inside transaction to prevent stale credit score snapshot bugs
          const currentStudent = await tx.user.findUnique({
            where: { id: booking.studentId },
          });

          const currentScore = currentStudent?.creditScore ?? 100;
          const newCreditScore = Math.max(0, currentScore - penaltyDeduction);
          const isRestricted = newCreditScore < 40;

          await tx.user.update({
            where: { id: booking.studentId },
            data: {
              creditScore: newCreditScore,
              isBookingRestricted: isRestricted,
            },
          });

          // Send NO_SHOW notification
          await tx.notification.create({
            data: {
              userId: booking.studentId,
              type: "NO_SHOW",
              message: `You were marked as NO-SHOW for your trip. ${penaltyDeduction} credit points deducted. Current score: ${newCreditScore}.${isRestricted ? " Booking privileges restricted." : ""}`,
            },
          });
        });

        totalNoShowsProcessed++;
      }

      // Mark trip as DEPARTED once boarding deadline has passed
      await prisma.trip.update({
        where: { id: trip.id },
        data: { status: "DEPARTED" },
      });

      // Emit realtime event for trip update
      await notifyRealtime(`trip:${trip.id}`, "trip-update", {
        tripId: trip.id,
        status: "DEPARTED",
      });
    }

    return NextResponse.json({
      success: true,
      processedTrips: expiredTrips.length,
      totalNoShowsProcessed,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Cron no-show processing failed" }, { status: 500 });
  }
}
