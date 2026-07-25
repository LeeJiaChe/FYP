import jwt from "jsonwebtoken";
import QRCode from "qrcode";

const QR_SECRET = process.env.JWT_SECRET || "tarumt-bus-booking-secret-key-2026-fyp";

export interface QRTokenPayload {
  bookingId: string;
  seatId?: string | null;
  tripId: string;
  issuedAt: number;
}

export async function generateQRTokenData(payload: Omit<QRTokenPayload, "issuedAt">) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      ...payload,
      issuedAt,
    },
    QR_SECRET,
    { expiresIn: "60s" } // 60 seconds TTL for dynamic security
  );

  const qrDataUrl = await QRCode.toDataURL(token, {
    margin: 2,
    width: 300,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return { token, qrDataUrl, issuedAt: new Date(issuedAt * 1000) };
}

export function verifyQRToken(token: string): { valid: boolean; payload?: QRTokenPayload; error?: string } {
  try {
    const payload = jwt.verify(token, QR_SECRET) as QRTokenPayload & { exp: number };
    return { valid: true, payload };
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return { valid: false, error: "QR expired, please refresh" };
    }
    return { valid: false, error: "Invalid QR token" };
  }
}
