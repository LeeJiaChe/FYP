import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  resendStudentVerification,
  StudentRegistrationError,
} from "@/features/identity/server";
import { resendVerificationRateLimiter } from "@/lib/rate-limit";
import { studentEmailSchema } from "@/shared/validation/student-identity";

const GENERIC_MESSAGE =
  "If an unverified student account exists, a new verification link has been prepared.";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!resendVerificationRateLimiter.check(ip)) {
    return NextResponse.json(
      { error: "Too many verification requests. Try again later." },
      { status: 429 },
    );
  }
  try {
    const body = await request.json();
    const email = studentEmailSchema.parse(body?.email);
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
    if (error instanceof ZodError) {
      return NextResponse.json({ message: GENERIC_MESSAGE, accepted: true });
    }
    console.error("Verification resend failed", error);
    return NextResponse.json(
      { error: "Unable to prepare verification email" },
      { status: 500 },
    );
  }
}
