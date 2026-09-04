import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validations";
import { registerRateLimiter } from "@/lib/rate-limit";
import {
  registerStudent,
  StudentRegistrationError,
} from "@/features/identity/server";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!registerRateLimiter.check(ip)) {
      return NextResponse.json({ error: "Too many registration attempts, please try again later" }, { status: 429 });
    }

    const body = await req.json();
    const validated = registerSchema.parse(body);

    return NextResponse.json(await registerStudent(validated), { status: 201 });
  } catch (err: any) {
    if (err instanceof StudentRegistrationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.code === "DELIVERY_UNAVAILABLE" ? 503 : 400 },
      );
    }
    if (err.name === "ZodError" || err.issues) {
      const msg = err.issues?.[0]?.message || err.errors?.[0]?.message || err.message || "Validation error";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
