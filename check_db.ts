import { prisma } from "./lib/prisma";

async function main() {
  const bookings = await prisma.booking.findMany({
    include: {
      trip: {
        include: {
          route: true,
          bus: true
        }
      }
    }
  });

  let badBookings = 0;
  for (const b of bookings) {
    if (!b.trip) console.log("Missing trip for booking:", b.id);
    else {
      if (!b.trip.route) { console.log("Missing route for trip:", b.trip.id); badBookings++; }
      if (!b.trip.bus) { console.log("Missing bus for trip:", b.trip.id); badBookings++; }
    }
  }

  console.log(`Total bookings: ${bookings.length}`);
  console.log(`Bad bookings: ${badBookings}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
