import { NextResponse } from "next/server";
import { z } from "zod";
import {
  StudentRegistrationError,
  verifyStudentEmail,
} from "@/features/identity/server";

const schema = z.object({ token: z.string().min(20) });

export async function POST(request: Request) {
  try {
    const { token } = schema.parse(await request.json());
    await verifyStudentEmail(token);
    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof StudentRegistrationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
