import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { passwordResetRequestRateLimiter } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  requestStaffPasswordReset,
} from "@/features/identity/server";
import { assertSameOriginMutation } from "@/shared/http/origin-check";
import { ApplicationError } from "@/shared/application/application-error";
import { parseJsonBody } from "@/shared/http/handle-route.server";

const GENERIC_MESSAGE =
  "If an eligible staff account exists, a password reset link has been prepared.";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
  } catch {
    return NextResponse.json({ error: "Cross-origin mutation rejected" }, { status: 403 });
  }
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!passwordResetRequestRateLimiter.check(ip)) {
      return NextResponse.json(
        { error: "Too many password reset requests. Try again later." },
        { status: 429 },
      );
    }
    const { email } = await parseJsonBody(request, forgotPasswordSchema, 4_096);
    return NextResponse.json(await requestStaffPasswordReset(email));
  } catch (error) {
    if (error instanceof ZodError || error instanceof ApplicationError) {
      return NextResponse.json({ message: GENERIC_MESSAGE });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
