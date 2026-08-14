import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productPolicy } from "@/shared/config/policies";
import { releaseNoShowReservation } from "@/features/bookings/server";

export async function POST(req: Request) {
  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.REALTIME_SERVICE_SECRET;

    if (!expectedSecret || cronSecret !== expectedSecret) {
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
          where: {
            status: "CONFIRMED",
            checkedInAt: null,
            boardingTripStop: { boardingDeadline: { lt: now } },
          },
          include: { student: true },
        },
      },
    });

    let totalNoShowsProcessed = 0;

    for (const trip of expiredTrips) {
      for (const booking of trip.bookings) {
        await releaseNoShowReservation(booking.id, { now: () => now });
        await prisma.$transaction(async (tx) => {
          // Create Penalty record
          const penaltyDeduction = productPolicy.noShowPenaltyPoints;
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

          const currentScore =
            currentStudent?.creditScore ?? productPolicy.initialCredit;
          const newCreditScore = Math.max(0, currentScore - penaltyDeduction);
          const isRestricted =
            newCreditScore < productPolicy.bookingRestrictionBelowCredit;

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

      // Phase 5 Trip progress is driver-owned. Phase 6 will migrate this
      // penalty job without inferring a DEPARTED transition from wall-clock time.
    }

    return NextResponse.json({
      success: true,
      processedTrips: expiredTrips.length,
      totalNoShowsProcessed,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Cron no-show processing failed" }, { status: 500 });
  }
}
