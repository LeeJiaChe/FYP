"use client";

import { AlertCircle, Lock } from "lucide-react";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Password reset failed.");
        return;
      }
      window.location.href = "/login?passwordReset=1";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="reset-password" className="mb-1.5 block text-xs font-semibold text-slate-300">New password</label>
        <div className="relative"><Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input id="reset-password" required type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-field pl-10!" /></div>
      </div>
      <div>
        <label htmlFor="reset-password-confirm" className="mb-1.5 block text-xs font-semibold text-slate-300">Confirm password</label>
        <div className="relative"><Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" /><input id="reset-password-confirm" required type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input-field pl-10!" /></div>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">Use at least 8 characters with uppercase, lowercase, and a number.</p>
      {error && <p className="flex items-center gap-2 text-xs text-red-400" role="alert"><AlertCircle className="h-4 w-4" />{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? "Resetting…" : "Reset password"}</button>
    </form>
  );
}
