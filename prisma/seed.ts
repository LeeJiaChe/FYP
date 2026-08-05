import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning old database records...");
  await prisma.deviceStatusLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.penaltyAppeal.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.seat.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.route.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding users...");
  const adminPasswordHash = await bcrypt.hash("admin1", 10);
  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "System Admin",
      email: "admin1@admin.tarc.edu.my",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

  const driver1 = await prisma.user.create({
    data: {
      name: "Ahmad Driver",
      email: "driver1@tarumt.edu.my",
      passwordHash: defaultPasswordHash,
      role: "DRIVER",
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      name: "Tan Boon Driver",
      email: "driver2@tarumt.edu.my",
      passwordHash: defaultPasswordHash,
      role: "DRIVER",
    },
  });

  const student1 = await prisma.user.create({
    data: {
      studentId: "2201991",
      name: "John Student",
      email: "student1@tarumt.edu.my",
      passwordHash: defaultPasswordHash,
      role: "STUDENT",
      creditScore: 100,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      studentId: "2201992",
      name: "Alice Wong",
      email: "student2@tarumt.edu.my",
      passwordHash: defaultPasswordHash,
      role: "STUDENT",
      creditScore: 85,
    },
  });

  const student3 = await prisma.user.create({
    data: {
      studentId: "2201993",
      name: "Bob Lee",
      email: "student3@tarumt.edu.my",
      passwordHash: defaultPasswordHash,
      role: "STUDENT",
      creditScore: 35,
      isBookingRestricted: true,
    },
  });

  const student4 = await prisma.user.create({
    data: {
      studentId: "2201994",
      name: "Charlie Tan",
      email: "student4@tarumt.edu.my",
      passwordHash: defaultPasswordHash,
      role: "STUDENT",
      creditScore: 100,
    },
  });

  console.log("Seeding buses...");
  const bus1 = await prisma.bus.create({
    data: {
      plateNumber: "TAR-1001",
      capacity: 20,
      status: "ACTIVE",
    },
  });

  const bus2 = await prisma.bus.create({
    data: {
      plateNumber: "TAR-1002",
      capacity: 24,
      status: "ACTIVE",
    },
  });

  const bus3 = await prisma.bus.create({
    data: {
      plateNumber: "TAR-1003",
      capacity: 16,
      status: "MAINTENANCE",
    },
  });

  const bus4 = await prisma.bus.create({
    data: {
      plateNumber: "TAR-1004",
      capacity: 20,
      status: "ACTIVE",
    },
  });

  console.log("Seeding directional routes (with -> arrows)...");
  const route1Out = await prisma.route.create({
    data: {
      name: "Main Campus -> LRT Wangsa Maju",
      stops: JSON.stringify(["Main Gate", "Block A", "Block D", "LRT Wangsa Maju"]),
    },
  });
  const route1In = await prisma.route.create({
    data: {
      name: "LRT Wangsa Maju -> Main Campus",
      stops: JSON.stringify(["LRT Wangsa Maju", "Block D", "Block A", "Main Gate"]),
    },
  });

  const route2Out = await prisma.route.create({
    data: {
      name: "Main Campus -> Setapak Jaya",
      stops: JSON.stringify(["Main Gate", "Sports Complex", "Setapak Jaya Bus Stop"]),
    },
  });
  const route2In = await prisma.route.create({
    data: {
      name: "Setapak Jaya -> Main Campus",
      stops: JSON.stringify(["Setapak Jaya Bus Stop", "Sports Complex", "Main Gate"]),
    },
  });

  const route3Out = await prisma.route.create({
    data: {
      name: "Campus Express -> Cyberjaya",
      stops: JSON.stringify(["Campus Terminal", "Cyberjaya Central"]),
    },
  });
  const route3In = await prisma.route.create({
    data: {
      name: "Cyberjaya -> Campus Express",
      stops: JSON.stringify(["Cyberjaya Central", "Campus Terminal"]),
    },
  });

  const route4Out = await prisma.route.create({
    data: {
      name: "Main Campus -> Danau Kota",
      stops: JSON.stringify(["Main Gate", "Block 3", "Block 6", "Danau Kota Suite"]),
    },
  });
  const route4In = await prisma.route.create({
    data: {
      name: "Danau Kota -> Main Campus",
      stops: JSON.stringify(["Danau Kota Suite", "Block 6", "Block 3", "Main Gate"]),
    },
  });

  const route5Out = await prisma.route.create({
    data: {
      name: "Main Campus -> LRT Taman Melati",
      stops: JSON.stringify(["Main Terminal", "Library Stop", "LRT Taman Melati"]),
    },
  });
  const route5In = await prisma.route.create({
    data: {
      name: "LRT Taman Melati -> Main Campus",
      stops: JSON.stringify(["LRT Taman Melati", "Library Stop", "Main Terminal"]),
    },
  });

  const route6 = await prisma.route.create({
    data: {
      name: "Internal Ring Shuttle (Clockwise)",
      stops: JSON.stringify(["Main Gate", "Block 3", "Block 4", "Block 5", "Block 6 Terminal"]),
    },
  });

  const route7 = await prisma.route.create({
    data: {
      name: "Internal Ring Shuttle (Anti-Clockwise)",
      stops: JSON.stringify(["Block 6 Terminal", "Block 5", "Block 4", "Block 3", "Main Gate"]),
    },
  });

  const route8Out = await prisma.route.create({
    data: {
      name: "Main Campus -> Sri Rampai",
      stops: JSON.stringify(["Main Gate", "Block C", "Sri Rampai LRT Station"]),
    },
  });
  const route8In = await prisma.route.create({
    data: {
      name: "Sri Rampai -> Main Campus",
      stops: JSON.stringify(["Sri Rampai LRT Station", "Block C", "Main Gate"]),
    },
  });

  const route9Out = await prisma.route.create({
    data: {
      name: "Main Campus -> Genting Klang Feeder",
      stops: JSON.stringify(["Main Gate", "PV12 Condominium", "Columbia Hospital", "Genting Klang Terminal"]),
    },
  });
  const route9In = await prisma.route.create({
    data: {
      name: "Genting Klang Feeder -> Main Campus",
      stops: JSON.stringify(["Genting Klang Terminal", "Columbia Hospital", "PV12 Condominium", "Main Gate"]),
    },
  });

  const allRoutes = [
    route1Out, route1In,
    route2Out, route2In,
    route3Out, route3In,
    route4Out, route4In,
    route5Out, route5In,
    route6, route7,
    route8Out, route8In,
    route9Out, route9In,
  ];

  console.log("Seeding trips across all 9 routes...");
  const now = new Date();

  // Seed trips for each route (multiple times per route today & tomorrow)
  for (let rIdx = 0; rIdx < allRoutes.length; rIdx++) {
    const route = allRoutes[rIdx];
    const assignedBus = rIdx % 2 === 0 ? bus1 : bus2;
    const assignedDriver = rIdx % 2 === 0 ? driver1 : driver2;

    // Time offsets for today and tomorrow
    const timeOffsets = [
      { hours: 1, durationMins: 30, status: rIdx === 0 ? "BOARDING" : "NOT_STARTED" },
      { hours: 3, durationMins: 30, status: "NOT_STARTED" },
      { hours: 5, durationMins: 30, status: "NOT_STARTED" },
      { hours: 24, durationMins: 30, status: "NOT_STARTED" }, // Tomorrow
    ];

    for (let tIdx = 0; tIdx < timeOffsets.length; tIdx++) {
      const offset = timeOffsets[tIdx];
      const departure = new Date(now.getTime() + offset.hours * 60 * 60 * 1000 + tIdx * 15 * 60 * 1000);
      const arrival = new Date(departure.getTime() + offset.durationMins * 60 * 1000);
      const deadline = new Date(departure.getTime() - 5 * 60 * 1000);

      const trip = await prisma.trip.create({
        data: {
          routeId: route.id,
          busId: assignedBus.id,
          driverId: assignedDriver.id,
          departureTime: departure,
          estimatedArrivalTime: arrival,
          boardingDeadline: deadline,
          status: offset.status as any,
        },
      });

      // Create seats for each trip
      for (let i = 1; i <= assignedBus.capacity; i++) {
        const isReserved = rIdx === 2 && tIdx === 0; // Route 3 first trip is fully reserved to demonstrate waitlist
        const seat = await prisma.seat.create({
          data: {
            tripId: trip.id,
            seatNumber: i,
            status: isReserved ? "RESERVED" : (rIdx === 0 && i <= 3 ? "RESERVED" : "AVAILABLE"),
          },
        });

        // Add device health log
        await prisma.deviceStatusLog.create({
          data: {
            seatId: seat.id,
            simulatedSignal: i === 7 ? "OFFLINE" : "OK",
          },
        });

        if (rIdx === 0 && i <= 3) {
          // Booking for Route 1 first trip
          const student = i === 1 ? student1 : i === 2 ? student2 : student4;
          await prisma.booking.create({
            data: {
              studentId: student.id,
              tripId: trip.id,
              seatId: seat.id,
              status: "CONFIRMED",
            },
          });
        }
      }
    }
  }

  // Add a waitlisted booking for Route 3 first trip
  const route3Trip1 = await prisma.trip.findFirst({ where: { routeId: route3Out.id } });
  if (route3Trip1) {
    await prisma.booking.create({
      data: {
        studentId: student4.id,
        tripId: route3Trip1.id,
        status: "WAITLISTED",
        waitlistPosition: 1,
      },
    });
  }

  console.log("Seeding penalties & appeals...");

  // Create a NO_SHOW booking for student3 to attach the penalty to
  const route1Trip1 = await prisma.trip.findFirst({ where: { routeId: route1Out.id } });
  let penaltyBookingId: string;

  if (route1Trip1) {
    // Find an available seat for student3's historical no-show booking
    const availableSeat = await prisma.seat.findFirst({
      where: { tripId: route1Trip1.id, status: "AVAILABLE" },
    });

    const noShowBooking = await prisma.booking.create({
      data: {
        studentId: student3.id,
        tripId: route1Trip1.id,
        seatId: availableSeat?.id || null,
        status: "NO_SHOW",
      },
    });
    penaltyBookingId = noShowBooking.id;
  } else {
    // Fallback: use student3's first booking if trip not found
    const fallbackBooking = await prisma.booking.findFirst({ where: { studentId: student3.id } });
    penaltyBookingId = fallbackBooking!.id;
  }

  const penalty = await prisma.penalty.create({
    data: {
      bookingId: penaltyBookingId,
      studentId: student3.id,
      creditPointsDeducted: 15,
      reason: "No-show on Trip TAR-1001 (Departure 08:00 AM)",
      status: "APPEALED",
    },
  });

  await prisma.penaltyAppeal.create({
    data: {
      penaltyId: penalty.id,
      studentId: student3.id,
      reason: "I had a sudden medical emergency and was admitted to the clinic. Medical certificate attached.",
      status: "PENDING",
    },
  });

  console.log("Seeding notifications...");
  await prisma.notification.create({
    data: {
      userId: student1.id,
      type: "BOOKING_CONFIRMED",
      message: "Your seat booking for Route 1 (TAR-1001) has been confirmed.",
    },
  });

  await prisma.notification.create({
    data: {
      userId: student3.id,
      type: "PENALTY_ISSUED",
      message: "A penalty of 15 credit points was issued due to a no-show. Booking privileges are restricted.",
    },
  });

  console.log("Database seeded successfully with 9 total routes!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
