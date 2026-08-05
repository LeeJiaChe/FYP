import { NextResponse } from "next/server";
import { COOKIE_NAME, getUserFromToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
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
    path: "/",
    expires: new Date(0),
  });
  return res;
}
