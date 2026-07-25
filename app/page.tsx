import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bus, ShieldCheck, QrCode, Activity, ArrowRight, UserCheck } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "ADMIN") redirect("/admin");
    if (user.role === "DRIVER") redirect("/driver");
    if (user.role === "STUDENT") redirect("/student");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="glass-panel border-b border-slate-800 py-4 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bus className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">
              TAR UMT <span className="text-blue-400">Shuttle</span>
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 transition-all"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border border-blue-500/30 text-blue-300 text-xs font-semibold mb-8 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400 live-dot"></span> Real-Time Campus Fleet Management
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
          Digital Campus Shuttle Booking & <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-sky-300">Live Seat Monitoring</span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          Reserve your bus seats online, board seamlessly with anti-fraud dynamic QR codes, and provide the transport department with real-time seat occupancy visibility.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="px-8 py-4 rounded-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-500/25 flex items-center gap-2 text-base transition-all hover:scale-105"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 rounded-2xl font-bold glass-card border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800/80 text-base transition-all"
          >
            Log In to Portal
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full max-w-5xl">
          <div className="glass-card p-6 rounded-3xl border border-slate-800 hover:border-blue-500/40 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Dynamic QR Boarding</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Auto-refreshing 60-second encrypted JWT QR tokens prevent screenshot sharing and enable instant boarding scans.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-800 hover:border-emerald-500/40 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Real-Time Seat Matrix</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Live Socket.io updates display seat occupancy (Available, Reserved, Checked-In, No-Show) and simulated IoT sensor health.
            </p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-800 hover:border-purple-500/40 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Waitlist & Penalty System</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automated waitlist promotion on cancellation, no-show detection, credit scoring, and admin penalty appeal workflows.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
