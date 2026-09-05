import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  resendStudentVerification,
  StudentRegistrationError,
} from "@/features/identity/server";
import { resendVerificationRateLimiter } from "@/lib/rate-limit";
import { studentEmailSchema } from "@/shared/validation/student-identity";
import { assertSameOriginMutation } from "@/shared/http/origin-check";
import { ApplicationError } from "@/shared/application/application-error";
import { parseJsonBody } from "@/shared/http/handle-route.server";

const GENERIC_MESSAGE =
  "If an unverified student account exists, a new verification link has been prepared.";
const requestSchema = z.object({ email: studentEmailSchema });

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
  } catch {
    return NextResponse.json({ error: "Cross-origin mutation rejected" }, { status: 403 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!resendVerificationRateLimiter.check(ip)) {
    return NextResponse.json(
      { error: "Too many verification requests. Try again later." },
      { status: 429 },
    );
  }
  try {
    const { email } = await parseJsonBody(request, requestSchema, 4_096);
    const result = await resendStudentVerification(email);
    return NextResponse.json({ message: GENERIC_MESSAGE, ...result });
  } catch (error) {
    if (
      error instanceof StudentRegistrationError &&
      error.code === "DELIVERY_UNAVAILABLE"
    ) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    // Invalid addresses and unknown/already verified accounts deliberately share
    // the same response to avoid exposing account existence.
    if (error instanceof ZodError || error instanceof ApplicationError) {
      return NextResponse.json({ message: GENERIC_MESSAGE, accepted: true });
    }
    console.error("Verification resend failed", error);
    return NextResponse.json(
      { error: "Unable to prepare verification email" },
      { status: 500 },
    );
  }
}
