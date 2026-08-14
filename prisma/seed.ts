import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { buildTripSnapshot } from "../src/features/trips/domain/build-trip-snapshot";
import { productPolicy } from "../src/shared/config/policies";

const prisma = new PrismaClient();

async function resetDemoData() {
  await prisma.deviceStatusLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.penaltyAppeal.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.tripSeat.deleteMany();
  await prisma.tripSegment.deleteMany();
  await prisma.tripStop.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.user.deleteMany();
}

async function createDemoTrip(input: {
  routeId: string;
  busId: string;
  driverId: string;
  departureTime: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    const route = await transaction.route.findUniqueOrThrow({
      where: { id: input.routeId },
      include: {
        routeStops: {
          orderBy: { position: "asc" },
          include: { stop: true },
        },
      },
    });
    const bus = await transaction.bus.findUniqueOrThrow({
      where: { id: input.busId },
    });
    const snapshot = buildTripSnapshot({
      originDeparture: input.departureTime,
      boardingCloseGraceMs: productPolicy.normalBoardingCloseGraceMs,
      seatedCapacity: bus.seatedCapacity,
      standingCapacity: bus.standingCapacity,
      routeStops: route.routeStops.map((routeStop) => ({
        stopId: routeStop.stopId,
        position: routeStop.position,
        stopCode: routeStop.stop.code,
        stopName: routeStop.stop.name,
        latitude: routeStop.stop.latitude.toNumber(),
        longitude: routeStop.stop.longitude.toNumber(),
        travelDurationToNextMinutes:
          routeStop.travelDurationToNextMinutes,
      })),
    });

    const trip = await transaction.trip.create({
      data: {
        routeId: input.routeId,
        busId: input.busId,
        driverId: input.driverId,
        departureTime: input.departureTime,
        estimatedArrivalTime: snapshot.estimatedArrivalTime,
        boardingDeadline: snapshot.stops[0]!.boardingDeadline,
        seatedCapacity: snapshot.seatedCapacity,
        standingCapacity: snapshot.standingCapacity,
      },
    });

    const tripStops = snapshot.stops.map((stop) => ({
      id: randomUUID(),
      tripId: trip.id,
      stopId: stop.stopId,
      position: stop.position,
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      latitude: stop.latitude,
      longitude: stop.longitude,
      plannedArrival: stop.plannedArrival,
      plannedDeparture: stop.plannedDeparture,
      boardingDeadline: stop.boardingDeadline,
    }));
    await transaction.tripStop.createMany({ data: tripStops });
    await transaction.tripSegment.createMany({
      data: snapshot.segmentPositions.map((position) => ({
        id: randomUUID(),
        tripId: trip.id,
        position,
        fromTripStopId: tripStops[position]!.id,
        toTripStopId: tripStops[position + 1]!.id,
      })),
    });

    const tripSeats = snapshot.seatNumbers.map((seatNumber) => ({
      id: randomUUID(),
      tripId: trip.id,
      seatNumber,
    }));
    await transaction.tripSeat.createMany({ data: tripSeats });
    await transaction.seat.createMany({
      data: tripSeats.map((seat) => ({
        tripId: trip.id,
        tripSeatId: seat.id,
        seatNumber: seat.seatNumber,
      })),
    });

    return trip;
  });
}

async function main() {
  console.log("Resetting demo data for Architecture v2 Phase 3...");
  await resetDemoData();

  const adminPasswordHash = await bcrypt.hash("admin1", 10);
  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  const [, driver1, driver2] = await Promise.all([
    prisma.user.create({
      data: {
        name: "System Admin",
        email: "admin1@admin.tarc.edu.my",
        passwordHash: adminPasswordHash,
        role: "ADMIN",
      },
    }),
    prisma.user.create({
      data: {
        name: "Ahmad Driver",
        email: "driver1@tarumt.edu.my",
        passwordHash: defaultPasswordHash,
        role: "DRIVER",
      },
    }),
    prisma.user.create({
      data: {
        name: "Tan Boon Driver",
        email: "driver2@tarumt.edu.my",
        passwordHash: defaultPasswordHash,
        role: "DRIVER",
      },
    }),
  ]);

  await prisma.user.createMany({
    data: [
      {
        studentId: "24WAB01234",
        name: "John Student",
        email: "student1@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
      },
      {
        studentId: "24WAB01235",
        name: "Alice Wong",
        email: "student2@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
        creditScore: 85,
      },
      {
        studentId: "24WAB01236",
        name: "Bob Lee",
        email: "student3@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
        creditScore: 35,
        isBookingRestricted: true,
      },
    ],
  });

  const [bus1, bus2, bus3] = await Promise.all([
    prisma.bus.create({
      data: {
        plateNumber: "TAR-1001",
        seatedCapacity: 20,
        standingCapacity: 8,
        status: "ACTIVE",
      },
    }),
    prisma.bus.create({
      data: {
        plateNumber: "TAR-1002",
        seatedCapacity: 28,
        standingCapacity: 12,
        status: "ACTIVE",
      },
    }),
    prisma.bus.create({
      data: {
        plateNumber: "TAR-1003",
        seatedCapacity: 16,
        standingCapacity: 4,
        status: "MAINTENANCE",
      },
    }),
  ]);
  void bus3;

  const stopRecords = await Promise.all([
    prisma.stop.create({
      data: {
        code: "TAR_MAIN",
        name: "TAR UMT Main Gate",
        latitude: 3.215006,
        longitude: 101.726176,
      },
    }),
    prisma.stop.create({
      data: {
        code: "WANGSA_LRT",
        name: "Wangsa Maju LRT",
        latitude: 3.205721,
        longitude: 101.731796,
      },
    }),
    prisma.stop.create({
      data: {
        code: "SETAPAK_CENTRAL",
        name: "Setapak Central",
        latitude: 3.200453,
        longitude: 101.717476,
      },
    }),
    prisma.stop.create({
      data: {
        code: "TAMAN_MELATI_LRT",
        name: "Taman Melati LRT",
        latitude: 3.219505,
        longitude: 101.721043,
      },
    }),
    prisma.stop.create({
      data: {
        code: "DANAU_KOTA",
        name: "Danau Kota",
        latitude: 3.204933,
        longitude: 101.714558,
      },
    }),
  ]);
  const [tarMain, wangsaLrt, setapakCentral, tamanMelatiLrt, danauKota] =
    stopRecords;

  async function createRoute(
    name: string,
    stops: Array<{ id: string; minutesToNext: number | null }>,
  ) {
    return prisma.route.create({
      data: {
        name,
        routeStops: {
          create: stops.map((stop, position) => ({
            stopId: stop.id,
            position,
            travelDurationToNextMinutes: stop.minutesToNext,
          })),
        },
      },
    });
  }

  const [setapakOutbound, setapakInbound, danauOutbound, danauInbound] =
    await Promise.all([
      createRoute("Demo: TAR UMT → Setapak Central", [
        { id: tarMain.id, minutesToNext: 8 },
        { id: wangsaLrt.id, minutesToNext: 10 },
        { id: setapakCentral.id, minutesToNext: null },
      ]),
      createRoute("Demo: Setapak Central → TAR UMT", [
        { id: setapakCentral.id, minutesToNext: 10 },
        { id: wangsaLrt.id, minutesToNext: 8 },
        { id: tarMain.id, minutesToNext: null },
      ]),
      createRoute("Demo: TAR UMT → Danau Kota", [
        { id: tarMain.id, minutesToNext: 7 },
        { id: tamanMelatiLrt.id, minutesToNext: 9 },
        { id: danauKota.id, minutesToNext: null },
      ]),
      createRoute("Demo: Danau Kota → TAR UMT", [
        { id: danauKota.id, minutesToNext: 9 },
        { id: tamanMelatiLrt.id, minutesToNext: 7 },
        { id: tarMain.id, minutesToNext: null },
      ]),
    ]);

  const now = new Date();
  const tripInputs = [
    [setapakOutbound.id, bus1.id, driver1.id, 2],
    [setapakInbound.id, bus2.id, driver2.id, 4],
    [danauOutbound.id, bus2.id, driver2.id, 26],
    [danauInbound.id, bus1.id, driver1.id, 29],
  ] as const;
  for (const [routeId, busId, driverId, hoursFromNow] of tripInputs) {
    await createDemoTrip({
      routeId,
      busId,
      driverId,
      departureTime: new Date(now.getTime() + hoursFromNow * 60 * 60 * 1_000),
    });
  }

  console.log(
    "Seeded 5 Stops, 4 directional demo Routes, 3 Buses, and 4 complete Trip snapshots.",
  );
  console.log(
    "No Phase 4 reserved-segment, waitlist, or walk-in data was created.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
