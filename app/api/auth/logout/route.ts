import { NextResponse } from "next/server";
import { COOKIE_NAME, getUserFromToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertSameOriginMutation } from "@/shared/http/origin-check";

export async function POST(request: Request) {
  try {
    assertSameOriginMutation(request);
  } catch {
    return NextResponse.json(
      { error: "Cross-origin mutation rejected" },
      { status: 403 },
    );
  }

  const user = await getUserFromToken();
  if (user) {
    try {
      await prisma.user.update({
        where: { id: user.userId },
        data: { sessionVersion: { increment: 1 } },
      });
    } catch (e) {
      // Ignore if user no longer exists
    }
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
  return res;
}
