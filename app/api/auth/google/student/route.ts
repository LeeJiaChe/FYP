import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createApplicationSession } from "@/lib/auth";
import { googleStudentLoginRateLimiter } from "@/lib/rate-limit";
import {
  createStudentOnboardingState,
  googleOnboardingCookieOptions,
  googleStudentCredentialSchema,
  GOOGLE_ONBOARDING_COOKIE,
  GoogleStudentAuthError,
  loginGoogleStudent,
} from "@/features/identity/server";
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
    if (!googleStudentLoginRateLimiter.check(ip)) {
      return NextResponse.json(
        { error: "Too many Google sign-in attempts. Try again later." },
        { status: 429 },
      );
    }
    const input = await parseJsonBody(
      request,
      googleStudentCredentialSchema,
      20_000,
    );
    const result = await loginGoogleStudent(input.credential);

    if (result.kind === "ONBOARDING_REQUIRED") {
      const response = NextResponse.json(
        {
          requiresOnboarding: true,
          profile: { email: result.identity.email, name: result.identity.name },
        },
        { status: 202 },
      );
      response.cookies.set(
        GOOGLE_ONBOARDING_COOKIE,
        createStudentOnboardingState(result.identity),
        googleOnboardingCookieOptions(),
      );
      return response;
    }

    const session = createApplicationSession(result.user);
    const response = NextResponse.json({
      requiresOnboarding: false,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        studentId: result.user.studentId,
      },
    });
    response.cookies.set(session.name, session.value, session.options);
    return response;
  } catch (error) {
    if (error instanceof GoogleStudentAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "UNAVAILABLE" ? 503 : 401 },
      );
    }
    if (error instanceof ZodError || error instanceof ApplicationError) {
      return NextResponse.json(
        {
          error:
            error instanceof ZodError
              ? (error.issues[0]?.message ?? "Invalid Google credential")
              : error.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
