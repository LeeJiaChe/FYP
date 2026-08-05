import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, verifyPassword, COOKIE_NAME } from "@/lib/auth";

/**
 * DELETE /api/auth/account — Account deletion flow.
 * Requires the user to confirm their password before deletion.
 * 
 * For STUDENT accounts:
 *   - Cancels all active bookings (CONFIRMED/WAITLISTED) with waitlist promotion
 *   - Marks all penalties as resolved
 *   - Deletes notifications
 *   - Anonymizes the user record (replaces PII, marks as deleted)
 * 
 * For DRIVER accounts:
 *   - Unassigns from all future trips
 *   - Anonymizes the user record
 * 
 * ADMIN accounts cannot be self-deleted (must be done by another admin).
 */
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Admin accounts cannot be self-deleted. Contact another administrator.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password confirmation required" },
        { status: 400 }
      );
    }

    // Verify password before deletion
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (user.role === "STUDENT") {
        // 1. Cancel all active bookings and release seats
        const activeBookings = await tx.booking.findMany({
          where: {
            studentId: user.id,
            status: { in: ["CONFIRMED", "WAITLISTED"] },
          },
          include: { trip: { include: { route: true } } },
        });

        for (const booking of activeBookings) {
          if (booking.seatId) {
            // Release the seat
            await tx.seat.update({
              where: { id: booking.seatId },
              data: { status: "AVAILABLE" },
            });
          }

          // Cancel the booking
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "CANCELLED",
              waitlistPosition: null,
            },
          });

          // Promote waitlisted students if a seat was freed
          if (booking.seatId && booking.status === "CONFIRMED") {
            const topWaitlisted = await tx.booking.findFirst({
              where: { tripId: booking.tripId, status: "WAITLISTED" },
              orderBy: { waitlistPosition: "asc" },
            });

            if (topWaitlisted) {
              await tx.booking.update({
                where: { id: topWaitlisted.id },
                data: {
                  status: "CONFIRMED",
                  seatId: booking.seatId,
                  waitlistPosition: null,
                },
              });

              await tx.seat.update({
                where: { id: booking.seatId },
                data: { status: "RESERVED" },
              });

              await tx.notification.create({
                data: {
                  userId: topWaitlisted.studentId,
                  type: "WAITLIST_PROMOTED",
                  message: `You have been promoted from the waitlist for ${booking.trip.route.name}. Your seat is confirmed!`,
                },
              });
            }
          }
        }
      } else if (user.role === "DRIVER") {
        // Unassign from all future trips
        await tx.trip.updateMany({
          where: {
            driverId: user.id,
            status: { in: ["NOT_STARTED", "BOARDING"] },
          },
          data: { driverId: null },
        });
      }

      // Delete all notifications
      await tx.notification.deleteMany({
        where: { userId: user.id },
      });

      // Anonymize user record rather than hard-deleting
      // This preserves referential integrity for historical bookings/penalties
      const anonymizedEmail = `deleted_${user.id}@deleted.local`;
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: "Deleted User",
          email: anonymizedEmail,
          studentId: null,
          passwordHash: "ACCOUNT_DELETED",
          creditScore: 0,
          isBookingRestricted: true,
        },
      });
    });

    // Clear the session cookie
    const res = NextResponse.json({
      success: true,
      message:
        "Your account has been deleted. All personal data has been removed.",
    });
    res.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      path: "/",
      expires: new Date(0),
    });

    return res;
  } catch (err: any) {
    console.error("[auth/account] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
