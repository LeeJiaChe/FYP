import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { passwordResetCompletionRateLimiter } from "@/lib/rate-limit";
import {
  resetPasswordSchema,
  resetStaffPassword,
  StaffPasswordResetError,
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
    if (!passwordResetCompletionRateLimiter.check(ip)) {
      return NextResponse.json(
        { error: "Too many password reset attempts. Try again later." },
        { status: 429 },
      );
    }
    const input = await parseJsonBody(request, resetPasswordSchema, 4_096);
    return NextResponse.json(
      await resetStaffPassword({ token: input.token, password: input.password }),
    );
  } catch (error) {
    if (error instanceof StaffPasswordResetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ZodError || error instanceof ApplicationError) {
      return NextResponse.json(
        {
          error:
            error instanceof ZodError
              ? (error.issues[0]?.message ?? "Password details are invalid")
              : error.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
