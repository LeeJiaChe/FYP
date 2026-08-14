import "server-only";

import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { serverEnvironment } from "@/shared/config/env.server";
import { productPolicy } from "@/shared/config/policies";

const QR_SECRET = serverEnvironment.qr.signingSecret;

export interface QRTokenPayload {
  bookingId: string;
  seatId?: string | null;
  tripSeatId: string;
  tripId: string;
  boardingTripStopId: string;
  dropOffTripStopId: string;
  passType: "RESERVED";
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
    { expiresIn: productPolicy.qrTokenLifetimeSeconds }
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
