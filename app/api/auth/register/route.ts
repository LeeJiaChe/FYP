import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, COOKIE_NAME } from "@/lib/auth";
import { registerSchema } from "@/lib/validations";
import { registerRateLimiter } from "@/lib/rate-limit";
import { productPolicy } from "@/shared/config/policies";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!registerRateLimiter.check(ip)) {
      return NextResponse.json({ error: "Too many registration attempts, please try again later" }, { status: 429 });
    }

    const body = await req.json();
    const validated = registerSchema.parse(body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validated.email },
          ...(validated.studentId ? [{ studentId: validated.studentId }] : []),
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email or Student ID already exists" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        name: validated.name,
        email: validated.email,
        studentId: validated.studentId || `STU${Date.now().toString().slice(-6)}`,
        passwordHash,
        role: "STUDENT",
        creditScore: productPolicy.initialCredit,
        isBookingRestricted: false,
      },
    });

    const token = signToken({
      userId: user.id,
      role: user.role as any,
      email: user.email,
      name: user.name,
      sessionVersion: user.sessionVersion,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        creditScore: user.creditScore,
        isBookingRestricted: user.isBookingRestricted,
      },
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
