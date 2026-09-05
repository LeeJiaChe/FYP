import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { registerSchema } from "@/lib/validations";
import { registerRateLimiter } from "@/lib/rate-limit";
import {
  registerStudent,
  StudentRegistrationError,
} from "@/features/identity/server";
import { assertSameOriginMutation } from "@/shared/http/origin-check";
import { ApplicationError } from "@/shared/application/application-error";
import { parseJsonBody } from "@/shared/http/handle-route.server";

export async function POST(req: Request) {
  try {
    assertSameOriginMutation(req);
  } catch {
    return NextResponse.json({ error: "Cross-origin mutation rejected" }, { status: 403 });
  }
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!registerRateLimiter.check(ip)) {
      return NextResponse.json({ error: "Too many registration attempts, please try again later" }, { status: 429 });
    }

    const validated = await parseJsonBody(req, registerSchema, 8_192);

    return NextResponse.json(await registerStudent(validated), { status: 201 });
  } catch (err: unknown) {
    if (err instanceof StudentRegistrationError) {
      return NextResponse.json(
        { error: err.message },
        {
          status:
            err.code === "DELIVERY_UNAVAILABLE"
              ? 503
              : err.code === "REGISTRATION_DISABLED"
                ? 403
                : 400,
        },
      );
    }
    if (err instanceof ZodError || err instanceof ApplicationError) {
      const msg =
        err instanceof ZodError
          ? err.issues[0]?.message || "Validation error"
          : err.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
