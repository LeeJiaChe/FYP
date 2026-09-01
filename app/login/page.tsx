"use client";

import { useState } from "react";
import Link from "next/link";
import { Bus, Lock, Mail, ArrowRight, AlertCircle, Info } from "lucide-react";

export default function LoginPage() {
  const [emailOrStudentId, setEmailOrStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrStudentId, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      const role = data.user.role;
      if (role === "ADMIN") window.location.href = "/admin";
      else if (role === "DRIVER") window.location.href = "/driver";
      else window.location.href = "/student";
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  // Helper function for quick demo credential fill
  function quickFill(userEmail: string, demoPassword = "password123") {
    setEmailOrStudentId(userEmail);
    setPassword(demoPassword);
  }

  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        {/* Logo Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-3 group">
            <div className="auth-logo">
              <Bus className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome back
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Sign in to TAR UMT Shuttle with your email or Student ID
          </p>
        </div>

        {/* Login Form Card */}
        <div className="auth-panel">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identity"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Email or Student ID
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="login-identity"
                  name="identity"
                  autoComplete="username"
                  type="text"
                  required
                  placeholder="student1@student.tarc.edu.my or your Student ID"
                  value={emailOrStudentId}
                  onChange={(e) => setEmailOrStudentId(e.target.value)}
                  className="input-field pl-10!"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="login-password"
                  name="password"
                  autoComplete="current-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10!"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Signing in..." : "Sign In"}{" "}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Seed Credentials Box */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
              <Info className="w-3.5 h-3.5 text-blue-400" /> Demo Quick Login
              Accounts:
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => quickFill("student1@student.tarc.edu.my")}
                className="btn-secondary min-h-10 px-2 text-[11px]"
              >
                Student 1
              </button>
              <button
                type="button"
                onClick={() => quickFill("driver1@tarumt.edu.my")}
                className="btn-secondary min-h-10 px-2 text-[11px]"
              >
                Driver 1
              </button>
              <button
                type="button"
                onClick={() => quickFill("admin1@admin.tarc.edu.my", "admin1")}
                className="btn-secondary min-h-10 px-2 text-[11px]"
              >
                Admin Staff
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              Student/driver password:{" "}
              <code className="text-slate-400">password123</code>. Admin:{" "}
              <code className="text-slate-400">admin1</code>.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Don&apos;t have a student account?{" "}
          <Link
            href="/register"
            className="text-blue-400 hover:underline font-semibold"
          >
            Register here
          </Link>
        </p>
      </div>
    </main>
  );
}
