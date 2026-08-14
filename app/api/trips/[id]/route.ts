import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { updateTripStatusSchema } from "@/lib/validations";
import { notifyRealtime } from "@/lib/realtime-client";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        route: true,
        bus: true,
        tripStops: {
          orderBy: { position: "asc" },
        },
        driver: {
          select: { id: true, name: true, email: true },
        },
        seats: {
          orderBy: { seatNumber: "asc" },
          include: {
            tripSeat: {
              include: {
                bookings: {
                  where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
                  include: {
                    student: {
                      select: { id: true, name: true, studentId: true },
                    },
                    boardingTripStop: true,
                    dropOffTripStop: true,
                  },
                },
              },
            },
            deviceLogs: {
              take: 1,
              orderBy: { recordedAt: "desc" },
            },
          },
        },
        waitlistEntries: {
          where: { status: "WAITING" },
          orderBy: [{ queuedAt: "asc" }, { id: "asc" }],
          include: {
            student: { select: { id: true, name: true, studentId: true } },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const formattedSeats = trip.seats.map((seat) => {
      const bookings = seat.tripSeat?.bookings ?? [];
      const primaryBooking = bookings[0];
      const compatibilityStatus =
        seat.status === "CHECKED_IN" || seat.status === "NO_SHOW"
          ? seat.status
          : bookings.length > 0
            ? "RESERVED"
            : "AVAILABLE";
      return {
        id: seat.id,
        seatNumber: seat.seatNumber,
        status: compatibilityStatus,
        booking: primaryBooking
          ? {
            id: primaryBooking.id,
            status: primaryBooking.status,
            studentName:
              user.role === "ADMIN" || user.role === "DRIVER" || primaryBooking.student.id === user.userId
                ? primaryBooking.student.name
                : "Student",
            studentId:
              user.role === "ADMIN" || user.role === "DRIVER" || primaryBooking.student.id === user.userId
                ? primaryBooking.student.studentId
                : "***",
            checkedInAt: primaryBooking.checkedInAt,
            checkInMethod: primaryBooking.checkInMethod,
            }
          : null,
        journeys: bookings.map((booking) => ({
          bookingId: booking.id,
          boardingStopName: booking.boardingTripStop.stopName,
          dropOffStopName: booking.dropOffTripStop.stopName,
          status: booking.status,
        })),
        deviceHealth: seat.deviceLogs[0]?.simulatedSignal || "OK",
      };
    });

    const totalSeats = trip.seatedCapacity;
    const availableSeats = formattedSeats.filter((s) => s.status === "AVAILABLE").length;
    const reservedSeats = formattedSeats.filter((s) => s.status === "RESERVED").length;
    const checkedInSeats = formattedSeats.filter((s) => s.status === "CHECKED_IN").length;
    const noShowSeats = formattedSeats.filter((s) => s.status === "NO_SHOW").length;

    return NextResponse.json({
      trip: {
        id: trip.id,
        routeId: trip.routeId,
        routeName: trip.route.name,
        routeStops: trip.tripStops.map((stop) => stop.stopName),
        tripStops: trip.tripStops.map((stop) => ({
          id: stop.id,
          stopId: stop.stopId,
          position: stop.position,
          code: stop.stopCode,
          name: stop.stopName,
          latitude: stop.latitude.toNumber(),
          longitude: stop.longitude.toNumber(),
          plannedArrival: stop.plannedArrival,
          plannedDeparture: stop.plannedDeparture,
          boardingDeadline: stop.boardingDeadline,
        })),
        busId: trip.busId,
        busPlateNumber: trip.bus.plateNumber,
        busCapacity: trip.seatedCapacity,
        seatedCapacity: trip.seatedCapacity,
        standingCapacity: trip.standingCapacity,
        driverId: trip.driverId,
        driverName: trip.driver?.name || "Unassigned",
        departureTime: trip.departureTime,
        estimatedArrivalTime: trip.estimatedArrivalTime,
        boardingDeadline: trip.boardingDeadline,
        status: trip.status,
        delayReason: trip.delayReason,
        seats: formattedSeats,
        waitlist:
          user.role === "ADMIN" || user.role === "DRIVER"
            ? trip.waitlistEntries
            : trip.waitlistEntries.filter((entry) => entry.studentId === user.userId),
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
    return NextResponse.json({ error: "Failed to fetch trip" }, { status: 500 });
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
          where: { status: "CONFIRMED" },
          select: { studentId: true },
        },
        waitlistEntries: {
          where: { status: "WAITING" },
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
        await tx.reservedSeatSegment.deleteMany({ where: { tripId: id } });
        await tx.booking.updateMany({
          where: { tripId: id, status: "CONFIRMED" },
          data: { status: "CANCELLED" },
        });
        await tx.waitlistEntry.updateMany({
          where: { tripId: id, status: "WAITING" },
          data: { status: "CANCELLED" },
        });

        // Reset all seats to AVAILABLE
        await tx.seat.updateMany({
          where: { tripId: id },
          data: { status: "AVAILABLE" },
        });

        // Notify affected students
        const studentIds = Array.from(new Set([
          ...trip.bookings.map((booking) => booking.studentId),
          ...trip.waitlistEntries.map((entry) => entry.studentId),
        ]));
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
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
  }
}
