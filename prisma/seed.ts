import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { buildTripSnapshot } from "../src/features/trips/domain/build-trip-snapshot";
import { productPolicy } from "../src/shared/config/policies";

const prisma = new PrismaClient();

async function resetDemoData() {
  await prisma.tripLocationSample.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.penaltyAppeal.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.reservedSeatSegment.deleteMany();
  await prisma.standingSegmentClaim.deleteMany();
  await prisma.walkInJourney.deleteMany();
  await prisma.walkInIntent.deleteMany();
  await prisma.tripStatusHistory.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.tripSeat.deleteMany();
  await prisma.tripSegment.deleteMany();
  await prisma.tripStop.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.serviceBlock.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.serviceLine.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.user.deleteMany();
}

async function createDemoTrip(input: {
  routeId: string;
  busId: string;
  driverId: string;
  departureTime: Date;
  blockId?: string;
  blockSequence?: number;
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
        blockId: input.blockId,
        blockSequence: input.blockSequence,
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
    return trip;
  });
}

async function main() {
  console.log("Resetting final prototype demo data...");
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
      },
      {
        studentId: "24WAB01237",
        name: "Chloe Lim",
        email: "student4@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
      },
      {
        studentId: "24WAB01238",
        name: "David Tan",
        email: "student5@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
      },
      {
        studentId: "24WAB01239",
        name: "E2E Reservation Student",
        email: "student6@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
      },
      {
        studentId: "24WAB01240",
        name: "E2E Waitlist Student",
        email: "student7@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
      },
      {
        studentId: "24WAB01241",
        name: "E2E Walk-in Student",
        email: "student8@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
      },
      {
        studentId: "24WAB01242",
        name: "E2E Appeal Student",
        email: "student9@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
        creditScore: 85,
      },
      {
        studentId: "24WAB01243",
        name: "E2E Boarding Student",
        email: "student10@student.tarc.edu.my",
        passwordHash: defaultPasswordHash,
        role: "STUDENT",
      },
    ],
  });

  const [bus1, bus2, bus3] = await Promise.all([
    prisma.bus.create({
      data: {
        plateNumber: "TAR-1001",
        seatedCapacity: 2,
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

  // Route families and stop names below follow the current TAR UMT DSA
  // Semester Bus Schedule (15-Jun-2026 to 20-Sep-2026, updated 06-Jul-2026)
  // and Bus Routes page, rechecked on 2026-08-22. Coordinates, travel durations,
  // vehicle assignments and relative Trip times are synthetic prototype data.
  // PV15/PV16 are intentionally absent because the current schedule says they
  // have not been pick-up/drop-off stops since 12-Jul-2022.
  const stopRecords = await Promise.all([
    prisma.stop.create({
      data: {
        code: "TAR_GATE_7",
        name: "TAR UMT Gate 7 / East Campus",
        latitude: 3.215006,
        longitude: 101.726176,
      },
    }),
    prisma.stop.create({
      data: {
        code: "TARVILLA",
        name: "Tarvilla",
        latitude: 3.2111,
        longitude: 101.7289,
      },
    }),
    prisma.stop.create({
      data: {
        code: "WANGSA_LRT",
        name: "LRT Wangsa Maju",
        latitude: 3.205721,
        longitude: 101.731796,
      },
    }),
    prisma.stop.create({
      data: {
        code: "WANGSA_METROVIEW",
        name: "Wangsa Metroview Bus Stop",
        latitude: 3.2037,
        longitude: 101.7208,
      },
    }),
    prisma.stop.create({
      data: {
        code: "HOSPITAL_ATM_TUANKU_MIZAN",
        name: "Hospital ATM Tuanku Mizan",
        latitude: 3.2077,
        longitude: 101.7158,
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
        code: "PV10",
        name: "PV10",
        latitude: 3.2141,
        longitude: 101.7202,
      },
    }),
    prisma.stop.create({
      data: {
        code: "PV12",
        name: "PV12",
        latitude: 3.219505,
        longitude: 101.721043,
      },
    }),
    prisma.stop.create({
      data: {
        code: "PV13",
        name: "PV13",
        latitude: 3.2178,
        longitude: 101.7191,
      },
    }),
    prisma.stop.create({
      data: {
        code: "PV18",
        name: "PV18",
        latitude: 3.2094,
        longitude: 101.7125,
      },
    }),
    prisma.stop.create({
      data: {
        code: "TERATAI_RESIDENCY",
        name: "Teratai Residency",
        latitude: 3.2077,
        longitude: 101.711,
      },
    }),
    prisma.stop.create({
      data: {
        code: "PRIMA_SETAPAK",
        name: "Prima Setapak",
        latitude: 3.2046,
        longitude: 101.7145,
      },
    }),
    prisma.stop.create({
      data: {
        code: "JALAN_GENTING_KELANG_BUS_STOP",
        name: "Bus Stop Jalan Genting Kelang",
        latitude: 3.202,
        longitude: 101.7181,
      },
    }),
    prisma.stop.create({
      data: {
        code: "MELATI_UTAMA",
        name: "Melati Utama",
        latitude: 3.2235,
        longitude: 101.7285,
      },
    }),
    prisma.stop.create({
      data: {
        code: "MELATI_LRT_JUNCTION",
        name: "Junction near Melati LRT",
        latitude: 3.2196,
        longitude: 101.7219,
      },
    }),
    prisma.stop.create({
      data: {
        code: "DANAU_KOTA_SUITE",
        name: "Danau Kota Suite Apartments",
        latitude: 3.2162,
        longitude: 101.7167,
      },
    }),
    prisma.stop.create({
      data: {
        code: "WANGSA_MAJU_SECTION_2",
        name: "Wangsa Maju Section 2",
        latitude: 3.204933,
        longitude: 101.714558,
      },
    }),
  ]);
  const [
    tarGate7,
    tarvilla,
    wangsaLrt,
    wangsaMetroview,
    hospitalMizan,
    setapakCentral,
    pv10,
    pv12,
    pv13,
    pv18,
    terataiResidency,
    primaSetapak,
    gentingKelangBusStop,
    melatiUtama,
    melatiLrtJunction,
    danauKotaSuite,
    wangsaMajuSection2,
  ] = stopRecords;

  async function createRoute(
    lineId: string,
    direction: "OUTBOUND" | "INBOUND",
    name: string,
    stops: Array<{ id: string; minutesToNext: number | null }>,
  ) {
    return prisma.route.create({
      data: {
        lineId,
        direction,
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

  const [wangsaLine, terataiLine, gentingLine, melatiLine, pvLine] =
    await Promise.all([
      prisma.serviceLine.create({
        data: {
          id: "00000000-0000-4000-8000-000000000001",
          code: "WANGSA_MAJU",
          name: "TAR UMT ↔ Wangsa Maju Section 2",
        },
      }),
      prisma.serviceLine.create({
        data: {
          id: "00000000-0000-4000-8000-000000000002",
          code: "TERATAI",
          name: "TAR UMT ↔ Teratai Residency",
        },
      }),
      prisma.serviceLine.create({
        data: {
          id: "00000000-0000-4000-8000-000000000003",
          code: "GENTING_KLANG",
          name: "TAR UMT ↔ Jalan Genting Klang",
        },
      }),
      prisma.serviceLine.create({
        data: {
          id: "00000000-0000-4000-8000-000000000004",
          code: "MELATI_UTAMA",
          name: "TAR UMT ↔ Melati Utama",
        },
      }),
      prisma.serviceLine.create({
        data: {
          id: "00000000-0000-4000-8000-000000000005",
          code: "PV_CORRIDOR",
          name: "TAR UMT ↔ PV10/PV12/PV13 Corridor",
        },
      }),
    ]);

  const [
    wangsaInbound,
    wangsaOutbound,
    terataiInbound,
    terataiOutbound,
    gentingInbound,
    gentingOutbound,
    melatiInbound,
    melatiOutbound,
    pvInbound,
    pvOutbound,
  ] = await Promise.all([
    createRoute(wangsaLine.id, "INBOUND", "Wangsa Maju Section 2 → TAR UMT", [
      { id: wangsaMajuSection2.id, minutesToNext: 4 },
      { id: hospitalMizan.id, minutesToNext: 4 },
      { id: wangsaMetroview.id, minutesToNext: 4 },
      { id: wangsaLrt.id, minutesToNext: 7 },
      { id: tarGate7.id, minutesToNext: null },
    ]),
    createRoute(wangsaLine.id, "OUTBOUND", "TAR UMT → Wangsa Maju Section 2", [
      { id: tarGate7.id, minutesToNext: 5 },
      { id: tarvilla.id, minutesToNext: 4 },
      { id: wangsaLrt.id, minutesToNext: 4 },
      { id: wangsaMetroview.id, minutesToNext: 4 },
      { id: wangsaMajuSection2.id, minutesToNext: null },
    ]),
    createRoute(terataiLine.id, "INBOUND", "Teratai Residency → TAR UMT", [
      { id: pv18.id, minutesToNext: 4 },
      { id: terataiResidency.id, minutesToNext: 5 },
      { id: primaSetapak.id, minutesToNext: 5 },
      { id: setapakCentral.id, minutesToNext: 7 },
      { id: tarGate7.id, minutesToNext: null },
    ]),
    createRoute(terataiLine.id, "OUTBOUND", "TAR UMT → Teratai Residency", [
      { id: tarGate7.id, minutesToNext: 7 },
      { id: setapakCentral.id, minutesToNext: 5 },
      { id: primaSetapak.id, minutesToNext: 5 },
      { id: terataiResidency.id, minutesToNext: 4 },
      { id: pv18.id, minutesToNext: null },
    ]),
    createRoute(gentingLine.id, "INBOUND", "Jalan Genting Klang → TAR UMT", [
      { id: gentingKelangBusStop.id, minutesToNext: 5 },
      { id: primaSetapak.id, minutesToNext: 5 },
      { id: setapakCentral.id, minutesToNext: 7 },
      { id: tarGate7.id, minutesToNext: null },
    ]),
    createRoute(gentingLine.id, "OUTBOUND", "TAR UMT → Jalan Genting Klang", [
      { id: tarGate7.id, minutesToNext: 7 },
      { id: setapakCentral.id, minutesToNext: 5 },
      { id: primaSetapak.id, minutesToNext: 5 },
      { id: gentingKelangBusStop.id, minutesToNext: null },
    ]),
    createRoute(melatiLine.id, "INBOUND", "Melati Utama → TAR UMT", [
      { id: melatiUtama.id, minutesToNext: 5 },
      { id: melatiLrtJunction.id, minutesToNext: 5 },
      { id: danauKotaSuite.id, minutesToNext: 4 },
      { id: pv10.id, minutesToNext: 7 },
      { id: tarGate7.id, minutesToNext: null },
    ]),
    createRoute(melatiLine.id, "OUTBOUND", "TAR UMT → Melati Utama", [
      { id: tarGate7.id, minutesToNext: 7 },
      { id: pv10.id, minutesToNext: 4 },
      { id: danauKotaSuite.id, minutesToNext: 5 },
      { id: melatiLrtJunction.id, minutesToNext: 5 },
      { id: melatiUtama.id, minutesToNext: null },
    ]),
    createRoute(pvLine.id, "INBOUND", "PV10/PV12/PV13 corridor → TAR UMT", [
      { id: pv13.id, minutesToNext: 4 },
      { id: pv10.id, minutesToNext: 4 },
      { id: pv12.id, minutesToNext: 5 },
      { id: setapakCentral.id, minutesToNext: 7 },
      { id: tarGate7.id, minutesToNext: null },
    ]),
    createRoute(pvLine.id, "OUTBOUND", "TAR UMT → PV10/PV12/PV13 corridor", [
      { id: tarGate7.id, minutesToNext: 7 },
      { id: setapakCentral.id, minutesToNext: 5 },
      { id: pv12.id, minutesToNext: 4 },
      { id: pv10.id, minutesToNext: 4 },
      { id: pv13.id, minutesToNext: null },
    ]),
  ]);

  const now = new Date();
  const prototypeBlock = await prisma.serviceBlock.create({
    data: {
      code: "BLOCK-001",
      serviceDate: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ),
      busId: bus1.id,
    },
  });
  // Relative offsets make these prototype Trips useful whenever the database is
  // reseeded. They are not the published TAR UMT timetable.
  const tripInputs = [
    [pvOutbound.id, bus1.id, driver1.id, 2],
    [pvInbound.id, bus1.id, driver2.id, 2.5],
    [wangsaOutbound.id, bus2.id, driver2.id, 26],
    [wangsaInbound.id, bus1.id, driver1.id, 29],
    [pvInbound.id, bus2.id, driver2.id, -3],
    [wangsaOutbound.id, bus2.id, driver1.id, 5 / 60],
    [terataiInbound.id, bus2.id, driver1.id, 6],
    [terataiOutbound.id, bus2.id, driver2.id, 8],
    [gentingInbound.id, bus2.id, driver1.id, 10],
    [gentingOutbound.id, bus2.id, driver2.id, 12],
    [melatiInbound.id, bus2.id, driver1.id, 14],
    [melatiOutbound.id, bus2.id, driver2.id, 16],
    [wangsaInbound.id, bus2.id, driver2.id, -0.5],
  ] as const;
  const demoTrips = [];
  for (const [index, [routeId, busId, driverId, hoursFromNow]] of tripInputs.entries()) {
    demoTrips.push(await createDemoTrip({
      routeId,
      busId,
      driverId,
      departureTime: new Date(now.getTime() + hoursFromNow * 60 * 60 * 1_000),
      ...(index < 2
        ? { blockId: prototypeBlock.id, blockSequence: index + 1 }
        : {}),
    }));
  }

  const [
    student1,
    student2,
    student3,
    student4,
    student5,
    student6,
    student7,
    student8,
    student9,
    student10,
  ] = await Promise.all(
    [
      "student1",
      "student2",
      "student3",
      "student4",
      "student5",
      "student6",
      "student7",
      "student8",
      "student9",
      "student10",
    ].map((student) =>
      prisma.user.findUniqueOrThrow({
        where: { email: `${student}@student.tarc.edu.my` },
      }),
    ),
  );
  const demonstrationTrip = await prisma.trip.findUniqueOrThrow({
    where: { id: demoTrips[0]!.id },
    include: {
      tripStops: { orderBy: { position: "asc" } },
      tripSegments: { orderBy: { position: "asc" } },
      tripSeats: { orderBy: { seatNumber: "asc" } },
    },
  });
  const stopA = demonstrationTrip.tripStops[0]!;
  const stopB = demonstrationTrip.tripStops[1]!;
  const stopC = demonstrationTrip.tripStops.at(-1)!;
  const segmentAB = demonstrationTrip.tripSegments[0]!;
  const remainingSegments = demonstrationTrip.tripSegments.slice(1);
  const [seat1, seat2] = demonstrationTrip.tripSeats;

  async function createReservedDemoJourney(input: {
    studentId: string;
    tripSeatId: string;
    boardingTripStopId: string;
    dropOffTripStopId: string;
    tripSegmentIds: string[];
  }) {
    return prisma.$transaction(async (transaction) => {
      const booking = await transaction.booking.create({
        data: {
          studentId: input.studentId,
          tripId: demonstrationTrip.id,
          tripSeatId: input.tripSeatId,
          boardingTripStopId: input.boardingTripStopId,
          dropOffTripStopId: input.dropOffTripStopId,
        },
      });
      await transaction.reservedSeatSegment.createMany({
        data: input.tripSegmentIds.map((tripSegmentId) => ({
          id: randomUUID(),
          bookingId: booking.id,
          tripId: demonstrationTrip.id,
          tripSeatId: input.tripSeatId,
          tripSegmentId,
        })),
      });
      return booking;
    });
  }

  await createReservedDemoJourney({
    studentId: student1.id,
    tripSeatId: seat1!.id,
    boardingTripStopId: stopA!.id,
    dropOffTripStopId: stopB!.id,
    tripSegmentIds: [segmentAB.id],
  });
  await createReservedDemoJourney({
    studentId: student2.id,
    tripSeatId: seat1!.id,
    boardingTripStopId: stopB!.id,
    dropOffTripStopId: stopC!.id,
    tripSegmentIds: remainingSegments.map((segment) => segment.id),
  });
  await createReservedDemoJourney({
    studentId: student4.id,
    tripSeatId: seat2!.id,
    boardingTripStopId: stopA!.id,
    dropOffTripStopId: stopC!.id,
    tripSegmentIds: demonstrationTrip.tripSegments.map((segment) => segment.id),
  });
  await prisma.waitlistEntry.create({
    data: {
      studentId: student5.id,
      tripId: demonstrationTrip.id,
      boardingTripStopId: stopA!.id,
      dropOffTripStopId: stopC!.id,
      status: "WAITING",
    },
  });
  await prisma.walkInIntent.create({
    data: {
      studentId: student3.id,
      tripId: demonstrationTrip.id,
      boardingTripStopId: stopA!.id,
      dropOffTripStopId: stopC!.id,
      status: "PENDING",
      issuedAt: now,
      expiresAt: new Date(stopA!.plannedDeparture.getTime() + productPolicy.bookingOpenLeadMs),
    },
  });
  await prisma.tripLocationSample.create({
    data: {
      id: randomUUID(),
      tripId: demonstrationTrip.id,
      latitude: stopA!.latitude,
      longitude: stopA!.longitude,
      recordedAt: now,
      source: "SIMULATED",
    },
  });

  // Deterministic Phase 9.5 browser-mutation fixtures. Preconditions are seeded;
  // booking, waitlist, Walk-in, boarding, appeal resolution and scheduling are
  // deliberately performed through the visible web workflows.
  void student6;
  void student7;
  void student8;

  const driverBoardingTrip = await prisma.trip.findUniqueOrThrow({
    where: { id: demoTrips[5]!.id },
    include: {
      tripStops: { orderBy: { position: "asc" } },
      tripSegments: { orderBy: { position: "asc" } },
      tripSeats: { orderBy: { seatNumber: "asc" } },
    },
  });
  const driverBooking = await prisma.booking.create({
    data: {
      studentId: student10.id,
      tripId: driverBoardingTrip.id,
      tripSeatId: driverBoardingTrip.tripSeats[0]!.id,
      boardingTripStopId: driverBoardingTrip.tripStops[0]!.id,
      dropOffTripStopId: driverBoardingTrip.tripStops.at(-1)!.id,
      status: "CONFIRMED",
    },
  });
  await prisma.reservedSeatSegment.createMany({
    data: driverBoardingTrip.tripSegments.map((segment) => ({
      id: randomUUID(),
      bookingId: driverBooking.id,
      tripId: driverBoardingTrip.id,
      tripSeatId: driverBoardingTrip.tripSeats[0]!.id,
      tripSegmentId: segment.id,
    })),
  });

  // One actively travelled prototype Trip is immediately available to the GPS
  // simulator and tracking UI after every reset.
  const gpsTrip = await prisma.trip.findUniqueOrThrow({
    where: { id: demoTrips[12]!.id },
    include: { tripStops: { orderBy: { position: "asc" } } },
  });
  const gpsStartedAt = new Date(now.getTime() - 5 * 60 * 1_000);
  await prisma.tripStop.update({
    where: { id: gpsTrip.tripStops[0]!.id },
    data: {
      actualArrival: gpsStartedAt,
      actualDeparture: gpsStartedAt,
      passedAt: gpsStartedAt,
    },
  });
  await prisma.trip.update({
    where: { id: gpsTrip.id },
    data: { status: "DEPARTED" },
  });
  await prisma.tripLocationSample.create({
    data: {
      id: randomUUID(),
      tripId: gpsTrip.id,
      latitude: gpsTrip.tripStops[0]!.latitude,
      longitude: gpsTrip.tripStops[0]!.longitude,
      recordedAt: now,
      source: "SIMULATED",
    },
  });

  const historicalTrip = await prisma.trip.findUniqueOrThrow({
    where: { id: demoTrips[4]!.id },
    include: {
      tripStops: { orderBy: { position: "asc" } },
      tripSeats: { orderBy: { seatNumber: "asc" } },
    },
  });
  const historicalBoardingStop = historicalTrip.tripStops[0]!;
  const historicalDropOffStop = historicalTrip.tripStops[2]!;
  const historicalProgressAt = new Date(now.getTime() - 2 * 60 * 60 * 1_000);
  await prisma.tripStop.updateMany({
    where: { tripId: historicalTrip.id },
    data: {
      actualArrival: historicalProgressAt,
      actualDeparture: historicalProgressAt,
      passedAt: historicalProgressAt,
    },
  });
  await prisma.trip.update({
    where: { id: historicalTrip.id },
    data: { status: "ARRIVED" },
  });
  const historicalNoShow = await prisma.booking.create({
    data: {
      studentId: student2.id,
      tripId: historicalTrip.id,
      tripSeatId: historicalTrip.tripSeats[0]!.id,
      boardingTripStopId: historicalBoardingStop.id,
      dropOffTripStopId: historicalDropOffStop.id,
      status: "NO_SHOW",
    },
  });
  const historicalPenalty = await prisma.penalty.create({
    data: {
      bookingId: historicalNoShow.id,
      studentId: student2.id,
      type: "RESERVED_NO_SHOW",
      creditPointsDeducted: productPolicy.noShowPenaltyPoints,
      reason: `Reserved journey no-show at ${historicalBoardingStop.stopName}`,
      status: "APPEALED",
    },
  });
  await prisma.penaltyAppeal.create({
    data: {
      penaltyId: historicalPenalty.id,
      studentId: student2.id,
      reason: "Demo appeal: medical emergency prevented timely cancellation.",
      status: "PENDING",
    },
  });
  await prisma.notification.create({
    data: {
      userId: student2.id,
      type: "PENALTY_ISSUED",
      deduplicationKey: `penalty-issued:${historicalPenalty.id}`,
      message: `A reserved no-show penalty deducted ${productPolicy.noShowPenaltyPoints} credit points for ${historicalBoardingStop.stopName}.`,
    },
  });

  const e2eNoShow = await prisma.booking.create({
    data: {
      studentId: student9.id,
      tripId: historicalTrip.id,
      tripSeatId: historicalTrip.tripSeats[1]!.id,
      boardingTripStopId: historicalBoardingStop.id,
      dropOffTripStopId: historicalDropOffStop.id,
      status: "NO_SHOW",
    },
  });
  await prisma.penalty.create({
    data: {
      bookingId: e2eNoShow.id,
      studentId: student9.id,
      type: "RESERVED_NO_SHOW",
      creditPointsDeducted: productPolicy.noShowPenaltyPoints,
      reason: `Reserved journey no-show at ${historicalBoardingStop.stopName}`,
      status: "ACTIVE",
    },
  });

  console.log(
    "Seeded 5 prototype ServiceLines, 17 source-based Stops, 10 directional canonical Routes, 3 Buses, 1 ServiceBlock, and 13 prototype Trip snapshots.",
  );
  console.log(
    "Route families and stop names are source-based; coordinates, travel durations, Trip times, assignments, and passenger records are prototype data.",
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
