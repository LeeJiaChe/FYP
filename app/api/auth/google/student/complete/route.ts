import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createApplicationSession } from "@/lib/auth";
import { googleStudentOnboardingRateLimiter } from "@/lib/rate-limit";
import {
  clearedGoogleOnboardingCookieOptions,
  completeGoogleStudentSchema,
  completeStudentOnboarding,
  GOOGLE_ONBOARDING_COOKIE,
  GoogleStudentAuthError,
} from "@/features/identity/server";
import { assertSameOriginMutation } from "@/shared/http/origin-check";
import { ApplicationError } from "@/shared/application/application-error";
import { parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(request: NextRequest) {
  try {
    assertSameOriginMutation(request);
  } catch {
    return NextResponse.json({ error: "Cross-origin mutation rejected" }, { status: 403 });
  }
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!googleStudentOnboardingRateLimiter.check(ip)) {
      return NextResponse.json(
        { error: "Too many profile completion attempts. Try again later." },
        { status: 429 },
      );
    }
    const input = await parseJsonBody(
      request,
      completeGoogleStudentSchema,
      4_096,
    );
    const user = await completeStudentOnboarding({
      onboardingState: request.cookies.get(GOOGLE_ONBOARDING_COOKIE)?.value,
      name: input.name,
      studentId: input.studentId,
    });
    const session = createApplicationSession(user);
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId,
      },
    });
    response.cookies.set(session.name, session.value, session.options);
    response.cookies.set(
      GOOGLE_ONBOARDING_COOKIE,
      "",
      clearedGoogleOnboardingCookieOptions(),
    );
    return response;
  } catch (error) {
    if (error instanceof GoogleStudentAuthError) {
      const response = NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "STUDENT_ID_CONFLICT" ? 409 : 400 },
      );
      if (
        error.code === "ONBOARDING_STATE_INVALID" ||
        error.code === "ONBOARDING_STATE_USED"
      ) {
        response.cookies.set(
          GOOGLE_ONBOARDING_COOKIE,
          "",
          clearedGoogleOnboardingCookieOptions(),
        );
      }
      return response;
    }
    if (error instanceof ZodError || error instanceof ApplicationError) {
      return NextResponse.json(
        {
          error:
            error instanceof ZodError
              ? (error.issues[0]?.message ?? "Profile details are invalid")
              : error.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
