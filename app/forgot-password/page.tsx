"use client";

import { Bus, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setPreviewUrl(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json();
      setMessage(body.message ?? body.error ?? "Unable to process the request.");
      setPreviewUrl(body.previewUrl ?? null);
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex"><div className="auth-logo"><Bus className="h-6 w-6 text-white" /></div></Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Forgot password?</h1>
          <p className="text-xs text-[var(--text-secondary)]">Driver and Admin accounts only</p>
        </div>
        <div className="auth-panel">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="staff-reset-email" className="mb-1.5 block text-xs font-semibold text-slate-300">Staff email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input id="staff-reset-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="input-field pl-10!" />
              </div>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Preparing…" : "Send reset link"}</button>
          </form>
          {message && <p className="text-xs leading-relaxed text-[var(--text-secondary)]" aria-live="polite">{message}</p>}
          {previewUrl && <a href={previewUrl} className="btn-secondary w-full">Open development reset preview</a>}
        </div>
        <p className="text-center text-xs"><Link href="/login" className="font-semibold text-blue-400 hover:underline">Return to sign in</Link></p>
      </div>
    </main>
  );
}
