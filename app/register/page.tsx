"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bus,
  User,
  Mail,
  Lock,
  IdCard,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          studentId,
          password,
          role: "STUDENT",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      window.location.href = "/student";
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main id="main-content" className="auth-shell">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-3 group">
            <div className="auth-logo">
              <Bus className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Create student account
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            Register to plan journeys and access boarding passes
          </p>
        </div>

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
                htmlFor="register-name"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="register-name"
                  name="name"
                  autoComplete="name"
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field pl-10!"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="register-student-id"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Student ID
              </label>
              <div className="relative">
                <IdCard className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="register-student-id"
                  name="studentId"
                  autoComplete="off"
                  type="text"
                  required
                  placeholder="e.g. 2201995"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="input-field pl-10!"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Stored in uppercase automatically.
              </p>
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Student Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="register-email"
                  name="email"
                  autoComplete="email"
                  type="email"
                  required
                  placeholder="your.name@student.tarc.edu.my"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10!"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Use your @student.tarc.edu.my address.
              </p>
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  id="register-password"
                  name="password"
                  autoComplete="new-password"
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
              {loading ? "Creating Account..." : "Register Account"}{" "}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400">
          Already registered?{" "}
          <Link
            href="/login"
            className="text-blue-400 hover:underline font-semibold"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </main>
  );
}
