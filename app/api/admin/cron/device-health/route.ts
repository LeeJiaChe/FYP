import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const expectedSecret = process.env.REALTIME_SERVICE_SECRET || "fyp-realtime-secret-key";

    if (cronSecret !== expectedSecret && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized cron call" }, { status: 401 });
    }

    // Pick a random seat to simulate signal change for demonstration purposes
    const seats = await prisma.seat.findMany({ take: 50 });
    if (seats.length === 0) {
      return NextResponse.json({ success: true, message: "No seats found" });
    }

    const randomSeat = seats[Math.floor(Math.random() * seats.length)];
    const signals: ("OK" | "OFFLINE" | "ERROR")[] = ["OK", "OK", "OK", "OK", "OFFLINE", "ERROR"];
    const simulatedSignal = signals[Math.floor(Math.random() * signals.length)];

    await prisma.deviceStatusLog.create({
      data: {
        seatId: randomSeat.id,
        simulatedSignal,
      },
    });

    return NextResponse.json({
      success: true,
      seatId: randomSeat.id,
      simulatedSignal,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Device health simulation failed" }, { status: 500 });
  }
}
