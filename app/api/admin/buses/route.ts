import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { createBusSchema, updateBusSchema } from "@/lib/validations";

export async function GET() {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 403 });
    }

    const buses = await prisma.bus.findMany({
      orderBy: { plateNumber: "asc" },
      include: {
        _count: { select: { trips: true } },
      },
    });
    return NextResponse.json({ buses });
  } catch (err: any) {
    console.error("[admin/buses GET] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const validated = createBusSchema.parse(body);

    const bus = await prisma.bus.create({
      data: validated,
    });

    return NextResponse.json({ success: true, bus });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[admin/buses POST] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, plateNumber, capacity, status } = updateBusSchema.parse(body);

    if (capacity !== undefined) {
      const busCurrent = await prisma.bus.findUnique({ where: { id } });
      if (busCurrent && capacity < busCurrent.capacity) {
        const activeTripsCount = await prisma.trip.count({
          where: { busId: id, status: { in: ["NOT_STARTED", "BOARDING"] } },
        });
        if (activeTripsCount > 0) {
          return NextResponse.json(
            { error: `Cannot decrease capacity. Bus has ${activeTripsCount} active or upcoming trip(s).` },
            { status: 400 }
          );
        }
      }
    }

    const updatedBus = await prisma.$transaction(async (tx) => {
      const bus = await tx.bus.update({
        where: { id },
        data: {
          ...(plateNumber ? { plateNumber } : {}),
          ...(capacity ? { capacity } : {}),
          ...(status ? { status } : {}),
        },
      });

      // If bus status changed to RETIRED or MAINTENANCE, cancel upcoming unstarted trips
      if (status === "RETIRED" || status === "MAINTENANCE") {
        const upcomingTrips = await tx.trip.findMany({
          where: {
            busId: id,
            status: { in: ["NOT_STARTED", "BOARDING"] },
          },
          include: {
            bookings: {
              where: { status: { in: ["CONFIRMED", "WAITLISTED"] } },
            },
          },
        });

        for (const trip of upcomingTrips) {
          // Cancel trip
          await tx.trip.update({
            where: { id: trip.id },
            data: {
              status: "CANCELLED",
              delayReason: `Bus ${bus.plateNumber} status updated to ${status}`,
            },
          });

          // Cancel bookings for trip
          const studentIds = Array.from(new Set(trip.bookings.map((b) => b.studentId)));

          await tx.booking.updateMany({
            where: { tripId: trip.id, status: { in: ["CONFIRMED", "WAITLISTED"] } },
            data: { status: "CANCELLED", seatId: null, waitlistPosition: null },
          });

          // Release seats
          await tx.seat.updateMany({
            where: { tripId: trip.id },
            data: { status: "AVAILABLE" },
          });

          // Notify students
          if (studentIds.length > 0) {
            await tx.notification.createMany({
              data: studentIds.map((userId) => ({
                userId,
                type: "CANCELLED",
                message: `Trip cancelled due to bus maintenance/retirement (${bus.plateNumber}).`,
              })),
            });
          }
        }
      }

      return bus;
    });

    return NextResponse.json({ success: true, bus: updatedBus });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[admin/buses PATCH] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Bus ID required" }, { status: 400 });

    const activeTripsCount = await prisma.trip.count({
      where: { busId: id, status: { in: ["NOT_STARTED", "BOARDING", "DEPARTED"] } },
    });

    if (activeTripsCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete bus assigned to ${activeTripsCount} active or upcoming trip(s). Reassign or cancel trips first.` },
        { status: 400 }
      );
    }

    // Soft delete per Q-006 to preserve historical references
    await prisma.bus.update({ where: { id }, data: { deletedAt: new Date(), status: "RETIRED" } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[admin/buses DELETE] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
