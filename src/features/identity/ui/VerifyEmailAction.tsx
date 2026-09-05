"use client";

import Link from "next/link";
import { useState } from "react";

export function VerifyEmailAction({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error ?? "Verification link is invalid or expired.");
        return;
      }
      window.location.href = "/login?verified=1";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        This compatibility flow verifies a development Student password account.
      </p>
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}
      <button type="button" onClick={verify} disabled={busy} className="btn-primary w-full">
        {busy ? "Verifying…" : "Verify account"}
      </button>
      <Link href="/login" className="btn-secondary w-full">Return to sign in</Link>
    </div>
  );
}
