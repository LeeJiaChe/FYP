import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { createTripSchema } from "@/lib/validations";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get("routeId");
    const dateStr = searchParams.get("date");
    const driverId = searchParams.get("driverId");

    const whereClause: any = {};
    if (routeId) whereClause.routeId = routeId;
    if (driverId) whereClause.driverId = driverId;

    if (dateStr) {
      const startOfDay = new Date(dateStr);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setHours(23, 59, 59, 999);

      whereClause.departureTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const trips = await prisma.trip.findMany({
      where: whereClause,
      include: {
        route: true,
        bus: true,
        driver: {
          select: { id: true, name: true, email: true },
        },
        seats: {
          select: { id: true, seatNumber: true, status: true },
        },
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { departureTime: "asc" },
    });

    const formattedTrips = trips.map((trip) => {
      const totalSeats = trip.bus.capacity;
      const availableSeats = trip.seats.filter((s) => s.status === "AVAILABLE").length;
      const reservedSeats = trip.seats.filter((s) => s.status === "RESERVED").length;
      const checkedInSeats = trip.seats.filter((s) => s.status === "CHECKED_IN").length;
      const noShowSeats = trip.seats.filter((s) => s.status === "NO_SHOW").length;

      return {
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
        stats: {
          totalSeats,
          availableSeats,
          reservedSeats,
          checkedInSeats,
          noShowSeats,
        },
      };
    });

    return NextResponse.json({ trips: formattedTrips });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch trips" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const currentUser = await getUserFromToken();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
    }

    const body = await req.json();
    const validated = createTripSchema.parse(body);

    const bus = await prisma.bus.findUnique({
      where: { id: validated.busId },
    });

    if (!bus) {
      return NextResponse.json({ error: "Selected bus does not exist" }, { status: 404 });
    }

    const departureTime = new Date(validated.departureTime);
    const estimatedArrivalTime = new Date(validated.estimatedArrivalTime);
    const boardingDeadline = new Date(departureTime.getTime() - 5 * 60 * 1000); // 5 mins buffer

    // Use transaction to create trip and all seat rows
    const result = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.create({
        data: {
          routeId: validated.routeId,
          busId: validated.busId,
          driverId: validated.driverId || null,
          departureTime,
          estimatedArrivalTime,
          boardingDeadline,
          status: "NOT_STARTED",
        },
      });

      // Auto-generate seats for the bus capacity
      const seatData = [];
      for (let i = 1; i <= bus.capacity; i++) {
        seatData.push({
          tripId: trip.id,
          seatNumber: i,
          status: "AVAILABLE",
        });
      }

      await tx.seat.createMany({
        data: seatData,
      });

      return trip;
    });

    return NextResponse.json({ success: true, trip: result });
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("Failed to create trip:", err);
    return NextResponse.json({ error: err.message || "Failed to create trip" }, { status: 500 });
  }
}
