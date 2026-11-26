import { AlertCircle, Bus } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";

import { GOOGLE_ONBOARDING_COOKIE, readStudentOnboardingProfile } from "@/features/identity/server";
import { CompleteStudentProfileForm } from "@/features/identity/ui";

export default async function CompleteStudentProfilePage() {
  const cookieStore = await cookies();
  const profile = readStudentOnboardingProfile(cookieStore.get(GOOGLE_ONBOARDING_COOKIE)?.value);

  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex">
            <div className="auth-logo"><Bus className="h-6 w-6 text-white" /></div>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Complete your student profile</h1>
          <p className="text-xs text-[var(--text-secondary)]">Your Student ID is required once.</p>
        </div>
        <div className="auth-panel">
          {profile ? (
            <CompleteStudentProfileForm profile={profile} />
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-2 text-sm text-red-400" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Student onboarding has expired. Continue with Google again.</p>
              <Link href="/register" className="btn-primary w-full">Continue with Google</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
