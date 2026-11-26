import { NextResponse } from "next/server";
import { z } from "zod";

import {
  resendStudentVerification,
} from "@/features/identity/server";
import { resendVerificationRateLimiter, rateLimitClientKey } from "@/lib/rate-limit";
import { studentEmailSchema } from "@/shared/validation/student-identity";
import { assertSameOriginMutation } from "@/shared/http/origin-check";
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
  const ip = rateLimitClientKey(request.headers);
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
  } catch {
    return NextResponse.json({ message: GENERIC_MESSAGE, accepted: true });
  }
}
