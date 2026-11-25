import { Bus } from "lucide-react";
import Link from "next/link";

import { VerifyEmailAction } from "@/features/identity/ui";

export default function VerifyEmailPage() {
  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex"><div className="auth-logo"><Bus className="h-6 w-6 text-white" /></div></Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Verify student email</h1>
        </div>
        <div className="auth-panel">
          <VerifyEmailAction />
        </div>
      </div>
    </main>
  );
}
