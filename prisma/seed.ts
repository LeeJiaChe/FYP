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
  const defaultPasswordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Transport Admin",
      email: "admin@tarumt.edu.my",
      passwordHash: defaultPasswordHash,
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

  console.log("Seeding routes...");
  const route1 = await prisma.route.create({
    data: {
      name: "Route 1: Main Campus <-> LRT Wangsa Maju",
      stops: JSON.stringify(["Main Gate", "Block A", "Block D", "LRT Wangsa Maju"]),
    },
  });

  const route2 = await prisma.route.create({
    data: {
      name: "Route 2: Main Campus <-> Setapak Jaya",
      stops: JSON.stringify(["Main Gate", "Sports Complex", "Setapak Jaya Bus Stop"]),
    },
  });

  const route3 = await prisma.route.create({
    data: {
      name: "Route 3: Campus Express <-> Cyberjaya",
      stops: JSON.stringify(["Campus Terminal", "Cyberjaya Central"]),
    },
  });

  console.log("Seeding trips...");
  const now = new Date();
  
  // Trip 1: Boarding soon (in 10 minutes)
  const trip1Departure = new Date(now.getTime() + 10 * 60 * 1000);
  const trip1Arrival = new Date(trip1Departure.getTime() + 25 * 60 * 1000);
  const trip1BoardingDeadline = new Date(trip1Departure.getTime() - 5 * 60 * 1000);

  const trip1 = await prisma.trip.create({
    data: {
      routeId: route1.id,
      busId: bus1.id,
      driverId: driver1.id,
      departureTime: trip1Departure,
      estimatedArrivalTime: trip1Arrival,
      boardingDeadline: trip1BoardingDeadline,
      status: "BOARDING",
    },
  });

  // Create 20 seats for Trip 1
  const trip1Seats = [];
  for (let i = 1; i <= bus1.capacity; i++) {
    const seat = await prisma.seat.create({
      data: {
        tripId: trip1.id,
        seatNumber: i,
        status: i <= 3 ? "RESERVED" : "AVAILABLE",
      },
    });
    trip1Seats.push(seat);

    // Add device health log
    await prisma.deviceStatusLog.create({
      data: {
        seatId: seat.id,
        simulatedSignal: i === 7 ? "OFFLINE" : "OK",
      },
    });
  }

  // Create confirmed bookings for Trip 1
  await prisma.booking.create({
    data: {
      studentId: student1.id,
      tripId: trip1.id,
      seatId: trip1Seats[0].id,
      status: "CONFIRMED",
    },
  });

  await prisma.booking.create({
    data: {
      studentId: student2.id,
      tripId: trip1.id,
      seatId: trip1Seats[1].id,
      status: "CONFIRMED",
    },
  });

  await prisma.booking.create({
    data: {
      studentId: student4.id,
      tripId: trip1.id,
      seatId: trip1Seats[2].id,
      status: "CONFIRMED",
    },
  });

  // Trip 2: Scheduled in 2 hours
  const trip2Departure = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const trip2Arrival = new Date(trip2Departure.getTime() + 30 * 60 * 1000);
  const trip2BoardingDeadline = new Date(trip2Departure.getTime() - 5 * 60 * 1000);

  const trip2 = await prisma.trip.create({
    data: {
      routeId: route2.id,
      busId: bus2.id,
      driverId: driver2.id,
      departureTime: trip2Departure,
      estimatedArrivalTime: trip2Arrival,
      boardingDeadline: trip2BoardingDeadline,
      status: "NOT_STARTED",
    },
  });

  for (let i = 1; i <= bus2.capacity; i++) {
    const seat = await prisma.seat.create({
      data: {
        tripId: trip2.id,
        seatNumber: i,
        status: "AVAILABLE",
      },
    });
    await prisma.deviceStatusLog.create({
      data: {
        seatId: seat.id,
        simulatedSignal: "OK",
      },
    });
  }

  // Trip 3: Fully Booked + Waitlist demo (2 seats bus simulation or filled seats)
  const trip3Departure = new Date(now.getTime() + 40 * 60 * 1000);
  const trip3Arrival = new Date(trip3Departure.getTime() + 45 * 60 * 1000);
  const trip3BoardingDeadline = new Date(trip3Departure.getTime() - 5 * 60 * 1000);

  const trip3 = await prisma.trip.create({
    data: {
      routeId: route3.id,
      busId: bus1.id,
      driverId: driver1.id,
      departureTime: trip3Departure,
      estimatedArrivalTime: trip3Arrival,
      boardingDeadline: trip3BoardingDeadline,
      status: "NOT_STARTED",
    },
  });

  // Reserve all 20 seats for trip3 to trigger waitlist logic easily
  for (let i = 1; i <= 20; i++) {
    const seat = await prisma.seat.create({
      data: {
        tripId: trip3.id,
        seatNumber: i,
        status: "RESERVED",
      },
    });
    await prisma.booking.create({
      data: {
        studentId: i % 2 === 0 ? student1.id : student2.id,
        tripId: trip3.id,
        seatId: seat.id,
        status: "CONFIRMED",
      },
    });
  }

  // Add a waitlisted student for Trip 3
  await prisma.booking.create({
    data: {
      studentId: student4.id,
      tripId: trip3.id,
      status: "WAITLISTED",
      waitlistPosition: 1,
    },
  });

  console.log("Seeding penalties & appeals...");
  const penalty = await prisma.penalty.create({
    data: {
      bookingId: (await prisma.booking.findFirst({ where: { studentId: student1.id } }))!.id,
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

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
