"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bus,
  Bell,
  LogOut,
  CreditCard,
  RefreshCw,
  Settings,
  Palette,
  ChevronDown,
  X,
  User as UserIcon,
  CheckCircle2,
  Info,
  AlertTriangle,
  Gift,
} from "lucide-react";
import { useTheme, THEMES } from "@/lib/theme";

interface User {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "DRIVER" | "ADMIN";
  studentId?: string | null;
  creditScore?: number;
  isBookingRestricted?: boolean;
}

export default function Navbar({ initialUser }: { initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser || null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, themes } = useTheme();
  const notifRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUser();
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) setShowThemePicker(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications/mine");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }

  async function markAsRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      fetchNotifications();
    } catch {}
  }

  async function markAllRead() {
    try {
      const unread = notifications.filter((n) => !n.isRead);
      await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" })));
      fetchNotifications();
    } catch {}
  }

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  }

  function getNotifIcon(type: string) {
    if (type.includes("CONFIRMED") || type.includes("PROMOTED")) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (type.includes("PENALTY") || type.includes("NO_SHOW") || type.includes("CANCELLED")) return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
    if (type.includes("APPEAL")) return <Gift className="w-3.5 h-3.5 text-amber-400" />;
    return <Info className="w-3.5 h-3.5 text-blue-400" />;
  }

  const currentTheme = themes.find((t) => t.id === theme);

  return (
    <header className="sticky top-0 z-50 nav-glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <Link
          href={user ? (user.role === "ADMIN" ? "/admin" : user.role === "DRIVER" ? "/driver" : "/student") : "/"}
          className="flex items-center space-x-3 group shrink-0"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
            style={{
              background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))`,
              boxShadow: `0 4px 16px var(--accent-glow)`,
            }}
          >
            <Bus className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="font-extrabold text-lg tracking-tight" style={{ color: "var(--text-primary)" }}>
              TAR UMT{" "}
              <span style={{ color: "var(--accent-secondary)" }}>Shuttle</span>
            </span>
            <span className="text-[10px] block -mt-0.5 font-medium tracking-wide" style={{ color: "var(--text-muted)" }}>
              Real-time Fleet & Seat Booking
            </span>
          </div>
        </Link>

        {/* Right Side */}
        {user ? (
          <div className="flex items-center gap-2">
            {/* Credit Score Badge — students only */}
            {user.role === "STUDENT" && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                style={
                  user.isBookingRestricted || (user.creditScore ?? 100) < 40
                    ? { background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#f87171" }
                    : { background: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)", color: "#4ade80" }
                }
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{user.creditScore ?? 100} pts</span>
                {user.isBookingRestricted && (
                  <span className="ml-1 bg-rose-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">RESTRICTED</span>
                )}
              </div>
            )}

            {/* Role Badge */}
            <span
              className="hidden sm:inline-block px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider uppercase border"
              style={
                user.role === "ADMIN"
                  ? { background: "rgba(168,85,247,0.1)", borderColor: "rgba(168,85,247,0.3)", color: "#c084fc" }
                  : user.role === "DRIVER"
                  ? { background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)", color: "#fbbf24" }
                  : { background: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.3)", color: "var(--accent-secondary)" }
              }
            >
              {user.role}
            </span>

            {/* Theme Picker */}
            <div ref={themeRef} className="relative">
              <button
                onClick={() => setShowThemePicker(!showThemePicker)}
                className="relative p-2 rounded-xl transition-all duration-200 tooltip-trigger"
                style={{ color: "var(--text-secondary)" }}
                title={`Theme: ${currentTheme?.name}`}
              >
                <div
                  className="w-5 h-5 rounded-full border-2"
                  style={{
                    background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))`,
                    borderColor: "var(--border-hover)",
                  }}
                />
              </button>

              {showThemePicker && (
                <div
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl p-3 z-50 animate-scale-in"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", boxShadow: "0 24px 60px var(--shadow-color)" }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Choose Theme</h3>
                    <Palette className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setTheme(t.id); setShowThemePicker(false); }}
                        className="flex flex-col items-start gap-1 p-2.5 rounded-xl text-left transition-all duration-200"
                        style={{
                          border: `1px solid ${theme === t.id ? "var(--accent-primary)" : "var(--border)"}`,
                          background: theme === t.id ? "var(--accent-glow)" : "transparent",
                        }}
                      >
                        <span className="text-base">{t.icon}</span>
                        <span className="text-[11px] font-bold" style={{ color: theme === t.id ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                          {t.name}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 rounded-xl transition-all duration-200"
                style={{ color: "var(--text-secondary)" }}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>

              {showNotifications && (
                <div
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", boxShadow: "0 24px 60px var(--shadow-color)" }}
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <Bell className="w-4 h-4" style={{ color: "var(--accent-secondary)" }} />
                      Notifications
                      {unreadCount > 0 && (
                        <span className="badge badge-blue">{unreadCount} new</span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[11px] font-semibold" style={{ color: "var(--accent-secondary)" }}>
                          Mark all read
                        </button>
                      )}
                      <button onClick={fetchNotifications} className="p-1 rounded-lg transition-colors" style={{ color: "var(--text-muted)" }}>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className="flex gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200"
                          style={{
                            background: n.isRead ? "transparent" : "var(--accent-glow)",
                            border: `1px solid ${n.isRead ? "var(--border)" : "var(--border-hover)"}`,
                          }}
                        >
                          <div className="mt-0.5 shrink-0">{getNotifIcon(n.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <span className="text-[11px] font-bold" style={{ color: "var(--accent-secondary)" }}>
                                {n.type.replace(/_/g, " ")}
                              </span>
                              <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                                {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                          </div>
                          {!n.isRead && (
                            <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: "var(--accent-primary)" }} />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div ref={userRef} className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl transition-all duration-200"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                  style={{ background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))` }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block text-xs font-semibold max-w-[80px] truncate" style={{ color: "var(--text-primary)" }}>
                  {user.name.split(" ")[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </button>

              {showUserMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-2xl p-2 z-50 animate-scale-in"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--glass-border)", boxShadow: "0 24px 60px var(--shadow-color)" }}
                >
                  <div className="px-3 py-2 mb-1 border-b" style={{ borderColor: "var(--border)" }}>
                    <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{user.name}</p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{user.email}</p>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 w-full"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Settings className="w-4 h-4" />
                    Personal Settings
                  </Link>

                  {user.role === "STUDENT" && (
                    <Link
                      href="/student"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 w-full"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <Bus className="w-4 h-4" />
                      My Dashboard
                    </Link>
                  )}

                  <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />

                  <button
                    onClick={handleLogout}
                    disabled={loading}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 w-full text-left"
                    style={{ color: "#f87171" }}
                  >
                    <LogOut className="w-4 h-4" />
                    {loading ? "Signing out..." : "Sign Out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="btn-ghost text-xs"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="btn-primary text-xs"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
