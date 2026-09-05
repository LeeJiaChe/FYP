import { NextResponse } from "next/server";
import { z } from "zod";
import {
  StudentRegistrationError,
  verifyStudentEmail,
} from "@/features/identity/server";
import { assertSameOriginMutation } from "@/shared/http/origin-check";
import { ApplicationError } from "@/shared/application/application-error";
import { parseJsonBody } from "@/shared/http/handle-route.server";

const schema = z.object({ token: z.string().min(20) });

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
  } catch {
    return NextResponse.json({ error: "Cross-origin mutation rejected" }, { status: 403 });
  }
  try {
    const { token } = await parseJsonBody(request, schema, 4_096);
    await verifyStudentEmail(token);
    return NextResponse.json({ verified: true });
  } catch (error) {
    if (error instanceof StudentRegistrationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof z.ZodError || error instanceof ApplicationError) {
      return NextResponse.json(
        {
          error:
            error instanceof z.ZodError
              ? error.issues[0]?.message
              : error.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
