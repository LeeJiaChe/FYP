import { NextResponse } from "next/server";
import { applicationSessionCookieOptions, COOKIE_NAME, getUserFromToken } from "@/lib/auth";
import { clearedGoogleOnboardingCookieOptions, GOOGLE_ONBOARDING_COOKIE } from "@/features/identity/server";
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
      await prisma.user.updateMany({
        where: { id: user.userId, sessionVersion: user.sessionVersion },
        data: { sessionVersion: { increment: 1 } },
      });
    } catch {
      return NextResponse.json({ error: "Could not revoke session. Please try again." }, { status: 503 });
    }
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, "", {
    ...applicationSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  res.cookies.set(GOOGLE_ONBOARDING_COOKIE, "", clearedGoogleOnboardingCookieOptions());
  return res;
}
