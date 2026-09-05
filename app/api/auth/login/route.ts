import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createApplicationSession } from "@/lib/auth";
import { loginRateLimiter } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validations";
import {
  loginWithPassword,
  PasswordLoginError,
} from "@/features/identity/server";
import { isBookingRestricted } from "@/features/penalties/public";
import { productPolicy } from "@/shared/config/policies";
import { assertSameOriginMutation } from "@/shared/http/origin-check";
import { ApplicationError } from "@/shared/application/application-error";
import { parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
  } catch {
    return NextResponse.json({ error: "Cross-origin mutation rejected" }, { status: 403 });
  }
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!loginRateLimiter.check(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts, please try again later" },
        { status: 429 },
      );
    }

    const validated = await parseJsonBody(request, loginSchema, 4_096);
    const user = await loginWithPassword({
      identifier: validated.emailOrStudentId,
      password: validated.password,
    });
    const session = createApplicationSession(user);
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
        creditScore: user.creditScore,
        isBookingRestricted: isBookingRestricted(user.creditScore, productPolicy),
      },
    });

    response.cookies.set(session.name, session.value, session.options);
    return response;
  } catch (error: unknown) {
    if (error instanceof PasswordLoginError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "USE_GOOGLE" ? 403 : 401 },
      );
    }
    if (error instanceof ZodError || error instanceof ApplicationError) {
      const msg =
        error instanceof ZodError
          ? error.issues[0]?.message || "Validation error"
          : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
