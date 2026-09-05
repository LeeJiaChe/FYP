"use client";

import { AlertCircle, Bus, CheckCircle2, IdCard, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function CompleteStudentProfilePage() {
  const [profile, setProfile] = useState<{ email: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/google/student/onboarding")
      .then(async (response) => {
        if (!response.ok) throw new Error("expired");
        return response.json();
      })
      .then((body) => {
        setProfile(body.profile);
        setName(body.profile.name);
      })
      .catch(() => setError("Student onboarding has expired. Continue with Google again."))
      .finally(() => setLoading(false));
  }, []);

  async function completeProfile(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google/student/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, studentId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Unable to complete your account.");
        return;
      }
      window.location.href = "/student";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">Loading verified Google account…</p>
          ) : profile ? (
            <form onSubmit={completeProfile} className="space-y-4">
              <div>
                <label htmlFor="google-account" className="mb-1.5 block text-xs font-semibold text-slate-300">Google account</label>
                <input id="google-account" value={profile.email} readOnly className="input-field opacity-80" />
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified TAR UMT Google account
                </p>
              </div>
              <div>
                <label htmlFor="complete-name" className="mb-1.5 block text-xs font-semibold text-slate-300">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input id="complete-name" required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="input-field pl-10!" />
                </div>
              </div>
              <div>
                <label htmlFor="complete-student-id" className="mb-1.5 block text-xs font-semibold text-slate-300">Student ID</label>
                <div className="relative">
                  <IdCard className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                  <input id="complete-student-id" required autoComplete="off" value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="e.g. 24WAB01234" className="input-field pl-10!" />
                </div>
              </div>
              {error && <p className="flex items-center gap-2 text-xs text-red-400" role="alert"><AlertCircle className="h-4 w-4" />{error}</p>}
              <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? "Completing account…" : "Complete account"}</button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="flex items-start gap-2 text-sm text-red-400" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
              <Link href="/register" className="btn-primary w-full">Continue with Google</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
