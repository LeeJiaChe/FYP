import { NextRequest } from "next/server";

import {
  GOOGLE_ONBOARDING_COOKIE,
  readStudentOnboardingProfile,
} from "@/features/identity/server";

export function GET(request: NextRequest) {
  const profile = readStudentOnboardingProfile(
    request.cookies.get(GOOGLE_ONBOARDING_COOKIE)?.value,
  );
  return profile
    ? Response.json({ profile })
    : Response.json(
        { error: "Onboarding session is missing or expired" },
        { status: 401 },
      );
}
