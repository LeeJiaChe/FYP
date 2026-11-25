import { Bus } from "lucide-react";
import Link from "next/link";

import { ResetPasswordForm } from "@/features/identity/ui";

export default function ResetPasswordPage() {
  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex"><div className="auth-logo"><Bus className="h-6 w-6 text-white" /></div></Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Reset staff password</h1>
          <p className="text-xs text-[var(--text-secondary)]">Choose a new password for your Driver or Admin account.</p>
        </div>
        <div className="auth-panel">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
