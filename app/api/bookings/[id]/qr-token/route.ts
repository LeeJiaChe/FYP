import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromToken } from "@/lib/auth";
import { generateQRTokenData } from "@/lib/qr";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromToken();
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id: bookingId } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { trip: true, seat: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.studentId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized access to this booking" }, { status: 403 });
    }

    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: `Cannot generate QR for booking status: ${booking.status}` }, { status: 400 });
    }

    const { token, qrDataUrl, issuedAt } = await generateQRTokenData({
      bookingId: booking.id,
      seatId: booking.seatId,
      tripId: booking.tripId,
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { qrTokenIssuedAt: issuedAt },
    });

    return NextResponse.json({
      token,
      qrDataUrl,
      issuedAt,
      expiresInSeconds: 60,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to generate QR token" }, { status: 500 });
  }
}
