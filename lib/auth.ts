import "server-only";

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { serverEnvironment } from "@/shared/config/env.server";

const JWT_SECRET = serverEnvironment.session.signingSecret;
export const COOKIE_NAME = "fyp_session";

export interface JWTPayload {
  userId: string;
  role: "STUDENT" | "DRIVER" | "ADMIN";
  email: string;
  name: string;
  sessionVersion: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Fast auth check — decodes the JWT without a DB round-trip.
 * Use this for all endpoints that only need userId + role.
 */
export async function getUserFromToken(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  // DB lookup to verify sessionVersion
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { sessionVersion: true, role: true, emailVerifiedAt: true }
  });

  if (
    !user ||
    user.sessionVersion !== payload.sessionVersion ||
    (user.role === "STUDENT" && !user.emailVerifiedAt)
  ) {
    return null;
  }

  return payload;
}

/**
 * Full DB lookup — use only when you need live fields like
 * creditScore or other live account fields that are NOT stored in the JWT.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) return null;
  if (user.sessionVersion !== payload.sessionVersion) return null;
  if (user.role === "STUDENT" && !user.emailVerifiedAt) return null;
  
  return user;
}
