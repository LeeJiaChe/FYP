import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { updateTripStatusSchema } from "@/lib/validations";
import { notifyRealtime } from "@/lib/realtime-client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        route: true,
        bus: true,
        driver: {
          select: { id: true, name: true, email: true },
        },
        seats: {
          orderBy: { seatNumber: "asc" },
          include: {
            booking: {
              include: {
                student: {
                  select: { id: true, name: true, studentId: true, email: true },
                },
              },
            },
            deviceLogs: {
              take: 1,
              orderBy: { recordedAt: "desc" },
            },
          },
        },
        bookings: {
          where: { status: "WAITLISTED" },
          orderBy: { waitlistPosition: "asc" },
          include: {
            student: { select: { id: true, name: true, studentId: true } },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const formattedSeats = trip.seats.map((seat) => ({
      id: seat.id,
      seatNumber: seat.seatNumber,
      status: seat.status,
      booking: seat.booking
        ? {
            id: seat.booking.id,
            status: seat.booking.status,
            studentName: seat.booking.student.name,
            studentId: seat.booking.student.studentId,
            checkedInAt: seat.booking.checkedInAt,
            checkInMethod: seat.booking.checkInMethod,
          }
        : null,
      deviceHealth: seat.deviceLogs[0]?.simulatedSignal || "OK",
    }));

    const totalSeats = trip.bus.capacity;
    const availableSeats = formattedSeats.filter((s) => s.status === "AVAILABLE").length;
    const reservedSeats = formattedSeats.filter((s) => s.status === "RESERVED").length;
    const checkedInSeats = formattedSeats.filter((s) => s.status === "CHECKED_IN").length;
    const noShowSeats = formattedSeats.filter((s) => s.status === "NO_SHOW").length;

    return NextResponse.json({
      trip: {
        id: trip.id,
        routeId: trip.routeId,
        routeName: trip.route.name,
        routeStops: JSON.parse(trip.route.stops || "[]"),
        busId: trip.busId,
        busPlateNumber: trip.bus.plateNumber,
        busCapacity: trip.bus.capacity,
        driverId: trip.driverId,
        driverName: trip.driver?.name || "Unassigned",
        departureTime: trip.departureTime,
        estimatedArrivalTime: trip.estimatedArrivalTime,
        boardingDeadline: trip.boardingDeadline,
        status: trip.status,
        delayReason: trip.delayReason,
        seats: formattedSeats,
        waitlist: trip.bookings,
        stats: {
          totalSeats,
          availableSeats,
          reservedSeats,
          checkedInSeats,
          noShowSeats,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch trip" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await getUserFromToken();
    if (!currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "DRIVER")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const validated = updateTripStatusSchema.parse(body);

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        route: true,
        bookings: {
          where: { status: { in: ["CONFIRMED", "WAITLISTED"] } },
          select: { studentId: true },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Driver authorization check
    if (currentUser.role === "DRIVER" && trip.driverId !== currentUser.userId) {
      return NextResponse.json({ error: "You can only update trips assigned to you" }, { status: 403 });
    }

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const updated = await tx.trip.update({
        where: { id },
        data: {
          status: validated.status,
          delayReason: validated.delayReason !== undefined ? validated.delayReason : trip.delayReason,
        },
      });

      // Cascading logic for CANCELLED trip
      if (validated.status === "CANCELLED") {
        // Cancel all confirmed & waitlisted bookings
        await tx.booking.updateMany({
          where: { tripId: id, status: { in: ["CONFIRMED", "WAITLISTED"] } },
          data: {
            status: "CANCELLED",
            seatId: null,
            waitlistPosition: null,
          },
        });

        // Reset all seats to AVAILABLE
        await tx.seat.updateMany({
          where: { tripId: id },
          data: { status: "AVAILABLE" },
        });

        // Notify affected students
        const studentIds = Array.from(new Set(trip.bookings.map((b) => b.studentId)));
        if (studentIds.length > 0) {
          const cancelMsg = `Trip for ${trip.route.name} departing at ${new Date(trip.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} was CANCELLED. ${validated.delayReason ? `Reason: ${validated.delayReason}` : ""}`;
          await tx.notification.createMany({
            data: studentIds.map((userId) => ({
              userId,
              type: "CANCELLED",
              message: cancelMsg,
            })),
          });
        }
      } else if (validated.status === "DELAYED") {
        const studentIds = Array.from(new Set(trip.bookings.map((b) => b.studentId)));
        if (studentIds.length > 0) {
          const delayMsg = `Trip for ${trip.route.name} is DELAYED. ${validated.delayReason ? `Reason: ${validated.delayReason}` : ""}`;
          await tx.notification.createMany({
            data: studentIds.map((userId) => ({
              userId,
              type: "TRIP_DELAYED",
              message: delayMsg,
            })),
          });
        }
      }

      return updated;
    });

    // Emit realtime event — fire-and-forget
    notifyRealtime(`trip:${id}`, "trip-update", {
      tripId: id,
      status: updatedTrip.status,
      delayReason: updatedTrip.delayReason,
    });

    return NextResponse.json({ success: true, trip: updatedTrip });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || "Failed to update trip" }, { status: 500 });
  }
}
