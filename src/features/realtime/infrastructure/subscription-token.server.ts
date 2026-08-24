import "server-only";

import jwt from "jsonwebtoken";

import { serverEnvironment } from "@/shared/config/env.server";

const TOKEN_LIFETIME_SECONDS = 60;

export interface RealtimeSubscriptionClaims {
  readonly purpose: "REALTIME_SUBSCRIPTION";
  readonly userId: string;
  readonly role: "STUDENT" | "DRIVER" | "ADMIN";
  readonly tripId: string;
}

export function signRealtimeSubscription(claims: RealtimeSubscriptionClaims) {
  const token = jwt.sign(claims, serverEnvironment.realtime.serviceSecret, {
    algorithm: "HS256",
    expiresIn: TOKEN_LIFETIME_SECONDS,
    issuer: "fyp-nextjs",
    audience: "fyp-realtime",
  });
  return {
    token,
    expiresAt: new Date(Date.now() + TOKEN_LIFETIME_SECONDS * 1_000),
  };
}

