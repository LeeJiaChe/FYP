import "server-only";

import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { serverEnvironment } from "@/shared/config/env.server";
import { canStudentIdentityAuthenticate } from "@/features/identity/public";

const JWT_SECRET = serverEnvironment.session.signingSecret;
export const COOKIE_NAME = "fyp_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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

export async function verifyPassword(
  password: string,
  hash: string | null,
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function applicationSessionCookieOptions(
  runtime: "development" | "test" | "production" = serverEnvironment.runtime,
) {
  return {
    httpOnly: true as const,
    secure: runtime === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function createApplicationSession(user: {
  id: string;
  role: JWTPayload["role"];
  email: string;
  name: string;
  sessionVersion: number;
}) {
  return {
    name: COOKIE_NAME,
    value: signToken({
      userId: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
      sessionVersion: user.sessionVersion,
    }),
    options: applicationSessionCookieOptions(),
  };
}

function verifyToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (
      typeof payload === "string" ||
      typeof payload.userId !== "string" ||
      (payload.role !== "STUDENT" &&
        payload.role !== "DRIVER" &&
        payload.role !== "ADMIN") ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      !Number.isInteger(payload.sessionVersion)
    ) {
      return null;
    }
    return payload as JWTPayload;
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
    select: {
      sessionVersion: true,
      role: true,
      passwordHash: true,
      emailVerifiedAt: true,
      studentIdentityAssurance: true,
    },
  });

  if (
    !user ||
    user.sessionVersion !== payload.sessionVersion ||
    user.role !== payload.role ||
    (user.role !== "STUDENT" && !user.passwordHash) ||
    (user.role === "STUDENT" &&
      !canStudentIdentityAuthenticate({
        assurance: user.studentIdentityAssurance,
        emailVerifiedAt: user.emailVerifiedAt,
        demoPasswordLoginEnabled:
          serverEnvironment.demoAuth.studentPasswordLoginEnabled,
      }))
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
  if (user.role !== payload.role) return null;
  if (user.role !== "STUDENT" && !user.passwordHash) return null;
  if (
    user.role === "STUDENT" &&
    !canStudentIdentityAuthenticate({
      assurance: user.studentIdentityAssurance,
      emailVerifiedAt: user.emailVerifiedAt,
      demoPasswordLoginEnabled:
        serverEnvironment.demoAuth.studentPasswordLoginEnabled,
    })
  ) return null;
  
  return user;
}
