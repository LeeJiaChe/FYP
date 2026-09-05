"use client";

import { AlertCircle, ArrowRight, Bus, Info, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { GoogleStudentButton } from "@/features/identity/ui";

const demoMode =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
  const [emailOrStudentId, setEmailOrStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrStudentId, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }
      window.location.href = data.user.role === "ADMIN"
        ? "/admin"
        : data.user.role === "DRIVER"
          ? "/driver"
          : "/student";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function quickFill(userEmail: string, demoPassword = "password123") {
    setEmailOrStudentId(userEmail);
    setPassword(demoPassword);
    setError(null);
  }

  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Link href="/" className="group inline-flex items-center space-x-3">
            <div className="auth-logo">
              <Bus className="h-6 w-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Secure access to TAR UMT Shuttle
          </p>
        </div>

        <div className="auth-panel">
          <section className="space-y-3" aria-labelledby="student-sign-in-heading">
            <p className="text-[11px] font-bold tracking-[0.18em] text-blue-400">
              STUDENTS
            </p>
            <h2 id="student-sign-in-heading" className="text-base font-bold">
              Continue with your institutional account
            </h2>
            <GoogleStudentButton />
            <p className="text-center text-xs text-[var(--text-secondary)]">
              Use your @student.tarc.edu.my account.
            </p>
          </section>

          <div className="flex items-center gap-3 py-1" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Staff access
            </span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-identity" className="mb-1.5 block text-xs font-semibold text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="login-identity"
                  autoComplete="username"
                  type="text"
                  required
                  placeholder="staff@tarumt.edu.my"
                  value={emailOrStudentId}
                  onChange={(event) => setEmailOrStudentId(event.target.value)}
                  className="input-field pl-10!"
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="login-password" className="text-xs font-semibold text-slate-300">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-semibold text-blue-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
                <input
                  id="login-password"
                  autoComplete="current-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-field pl-10!"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in…" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="text-center text-[11px] text-slate-500">Driver and Admin only</p>
          </form>

          {demoMode && (
            <div className="space-y-2 border-t border-slate-800/80 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                <Info className="h-3.5 w-3.5 text-blue-400" /> Demo Quick Login Accounts
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button type="button" onClick={() => quickFill("student1@student.tarc.edu.my")} className="btn-secondary min-h-10 px-2 text-[11px]">
                  Student 1
                </button>
                <button type="button" onClick={() => quickFill("driver1@tarumt.edu.my")} className="btn-secondary min-h-10 px-2 text-[11px]">
                  Driver 1
                </button>
                <button type="button" onClick={() => quickFill("admin1@admin.tarc.edu.my", "admin1")} className="btn-secondary min-h-10 px-2 text-[11px]">
                  Admin Staff
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          New student? <Link href="/register" className="font-semibold text-blue-400 hover:underline">Register with Google</Link>
        </p>
      </div>
    </main>
  );
}
