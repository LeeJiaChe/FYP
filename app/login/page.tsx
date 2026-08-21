"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bus, Lock, Mail, ArrowRight, AlertCircle, Info } from "lucide-react";

export default function LoginPage() {
  const [emailOrStudentId, setEmailOrStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-3 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Bus className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">TAR UMT Bus Portal</h1>
          <p className="text-xs text-slate-400">Sign in with your email or Student ID</p>
        </div>

        {/* Login Form Card */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-identity" className="block text-xs font-semibold text-slate-300 mb-1.5">Email or Student ID</label>
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
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
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {loading ? "Signing in..." : "Sign In"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Seed Credentials Box */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
              <Info className="w-3.5 h-3.5 text-blue-400" /> Demo Quick Login Accounts:
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => quickFill("student1@student.tarc.edu.my")}
                className="py-1.5 px-2 bg-blue-950/40 hover:bg-blue-900/50 border border-blue-500/30 rounded-lg text-blue-300 text-center font-medium transition-colors"
              >
                Student 1
              </button>
              <button
                type="button"
                onClick={() => quickFill("driver1@tarumt.edu.my")}
                className="py-1.5 px-2 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 rounded-lg text-amber-300 text-center font-medium transition-colors"
              >
                Driver 1
              </button>
              <button
                type="button"
                onClick={() => quickFill("admin1@admin.tarc.edu.my", "admin1")}
                className="py-1.5 px-2 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 rounded-lg text-purple-300 text-center font-medium transition-colors"
              >
                Admin Staff
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center">
              Student/driver password: <code className="text-slate-400">password123</code>. Admin: <code className="text-slate-400">admin1</code>.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Don't have a student account?{" "}
          <Link href="/register" className="text-blue-400 hover:underline font-semibold">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
