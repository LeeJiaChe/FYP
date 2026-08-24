import "server-only";

import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import QRCode from "qrcode";
import { z } from "zod";

import {
  PASS_PURPOSES,
  type DurablePassClaims,
  type TimedPassClaims,
} from "../domain/pass-contract";
import { serverEnvironment } from "@/shared/config/env.server";
import { productPolicy, type ProductPolicy } from "@/shared/config/policies";
import { systemClock, type Clock } from "@/shared/time/clock";

const signedClaimsSchema = z.object({
  purpose: z.enum(PASS_PURPOSES),
  journeyKind: z.enum(["RESERVED", "WALK_IN"]),
  recordId: z.string().uuid(),
  studentId: z.string().uuid(),
  tripId: z.string().uuid(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
  jti: z.string().uuid(),
});

export class PassTokenError extends Error {
  readonly code: "INVALID" | "EXPIRED";

  constructor(code: "INVALID" | "EXPIRED", message: string) {
    super(message);
    this.name = "PassTokenError";
    this.code = code;
  }
}

export async function issueSignedPass(
  claims: DurablePassClaims,
  clock: Clock = systemClock,
  policy: ProductPolicy = productPolicy,
) {
  const issuedAt = Math.floor(clock.now().getTime() / 1_000);
  const expiresAt = issuedAt + policy.qrTokenLifetimeSeconds;
  const tokenId = randomUUID();
  const token = jwt.sign(
    { ...claims, iat: issuedAt, exp: expiresAt, jti: tokenId },
    serverEnvironment.qr.signingSecret,
    { algorithm: "HS256" },
  );
  const qrDataUrl = await QRCode.toDataURL(token, {
    margin: 2,
    width: 300,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
  return {
    token,
    qrDataUrl,
    issuedAt: new Date(issuedAt * 1_000),
    expiresAt: new Date(expiresAt * 1_000),
    expiresInSeconds: policy.qrTokenLifetimeSeconds,
  };
}

export function verifySignedPass(
  token: string,
  clock: Clock = systemClock,
): TimedPassClaims {
  try {
    const decoded = jwt.verify(token, serverEnvironment.qr.signingSecret, {
      algorithms: ["HS256"],
      clockTimestamp: Math.floor(clock.now().getTime() / 1_000),
    });
    const claims = signedClaimsSchema.parse(decoded);
    return {
      purpose: claims.purpose,
      journeyKind: claims.journeyKind,
      recordId: claims.recordId,
      studentId: claims.studentId,
      tripId: claims.tripId,
      issuedAt: claims.iat,
      expiresAt: claims.exp,
      tokenId: claims.jti,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new PassTokenError("EXPIRED", "Pass expired; refresh it and scan again");
    }
    throw new PassTokenError("INVALID", "Pass signature or claims are invalid");
  }
}
