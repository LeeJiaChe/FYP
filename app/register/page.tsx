import { Bus } from "lucide-react";
import Link from "next/link";

import { GoogleStudentButton } from "@/features/identity/ui";

export default function RegisterPage() {
  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="group inline-flex items-center space-x-3">
            <div className="auth-logo">
              <Bus className="h-6 w-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Student registration</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Use your TAR UMT Google account to continue.
          </p>
        </div>
        <div className="auth-panel">
          <GoogleStudentButton />
          <p className="text-center text-xs text-[var(--text-secondary)]">
            Only @student.tarc.edu.my institutional accounts are accepted.
          </p>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-xs leading-relaxed text-slate-300">
            First time here? After Google verifies your institutional account,
            you will enter your Student ID once to complete your profile.
          </div>
        </div>
        <p className="text-center text-xs text-slate-400">
          Already registered? <Link href="/login" className="font-semibold text-blue-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
