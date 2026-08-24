"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Bus,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Gift,
  Info,
  LogOut,
  Moon,
  RefreshCw,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { productPolicy } from "@/shared/config/policies";

interface User {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "DRIVER" | "ADMIN";
  studentId?: string | null;
  creditScore?: number;
  isBookingRestricted?: boolean;
}

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function Navbar({ initialUser }: { initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser || null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialUser) void fetchUser();
    void fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 15000);
    return () => window.clearInterval(interval);
  }, [initialUser]);

  useEffect(() => {
    function closeMenus(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent) {
        const target = event.target as Node;
        if (notifRef.current?.contains(target) || userRef.current?.contains(target)) return;
      }
      setShowNotifications(false);
      setShowUserMenu(false);
    }
    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", closeMenus);
    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", closeMenus);
    };
  }, []);

  async function fetchUser() {
    try {
      const response = await fetch("/api/auth/me");
      setUser(response.ok ? (await response.json()).user : null);
    } catch { setUser(null); }
  }

  async function fetchNotifications() {
    try {
      const response = await fetch("/api/notifications/mine");
      if (!response.ok) return;
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }

  async function markAsRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    void fetchNotifications();
  }

  async function markAllRead() {
    await Promise.all(
      notifications.filter((item) => !item.isRead).map((item) =>
        fetch(`/api/notifications/${item.id}/read`, { method: "PATCH" }),
      ),
    );
    void fetchNotifications();
  }

  async function handleLogout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function notificationIcon(type: string) {
    if (type.includes("CONFIRMED") || type.includes("PROMOTED")) return <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />;
    if (type.includes("PENALTY") || type.includes("NO_SHOW") || type.includes("CANCELLED")) return <AlertTriangle aria-hidden className="size-4 text-red-600" />;
    if (type.includes("APPEAL")) return <Gift aria-hidden className="size-4 text-amber-600" />;
    return <Info aria-hidden className="size-4 text-blue-600" />;
  }

  const homeHref = user?.role === "ADMIN" ? "/admin" : user?.role === "DRIVER" ? "/driver" : user ? "/student" : "/";
  const score = user?.creditScore ?? productPolicy.initialCredit;
  const restricted = score < productPolicy.bookingRestrictionBelowCredit;

  return (
    <header className="nav-glass sticky top-0 z-50">
      <div className="nav-inner mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={homeHref} className="nav-brand group flex min-w-0 items-center gap-3" aria-label="TAR UMT Shuttle home">
          <span className="nav-brand-mark grid size-9 shrink-0 place-items-center rounded-[9px] bg-[var(--institutional)] text-white">
            <Bus aria-hidden className="size-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold tracking-[-0.01em] text-[var(--text)] sm:text-base">TAR UMT Shuttle</span>
            <span className="hidden text-[0.68rem] font-medium text-[var(--text-muted)] sm:block">Campus transport operations</span>
          </span>
        </Link>

        <div className="nav-utilities flex items-center gap-1.5 sm:gap-2">
          {user?.role === "STUDENT" && (
            <span className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium tabular-nums sm:flex ${restricted ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>
              <CreditCard aria-hidden className="size-3.5" /> {score} credit
              {restricted && <span>Restricted</span>}
            </span>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="nav-utility-button nav-theme-toggle grid size-10 place-items-center rounded-[9px] border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
            aria-label={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
            title={`Current theme: ${theme === "light" ? "Light" : "Dark"}`}
          >
            {theme === "light" ? <Moon aria-hidden className="size-[18px]" /> : <Sun aria-hidden className="size-[18px]" />}
          </button>

          {user ? (
            <>
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setShowNotifications((value) => !value); setShowUserMenu(false); }}
                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                  aria-expanded={showNotifications}
                  aria-controls="notification-menu"
                  className="nav-utility-button nav-notifications relative grid size-10 place-items-center rounded-[9px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                >
                  <Bell aria-hidden className="size-5" />
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </button>
                {showNotifications && (
                  <section id="notification-menu" aria-label="Notifications" className="absolute right-0 top-full mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-menu)]">
                    <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                      <div>
                        <h2 className="text-sm font-bold">Notifications</h2>
                        <p className="text-xs text-[var(--text-muted)]">{unreadCount ? `${unreadCount} unread` : "You are up to date"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && <button type="button" onClick={markAllRead} className="px-2 py-2 text-xs font-semibold text-[var(--brand)]">Mark all read</button>}
                        <button type="button" aria-label="Refresh notifications" onClick={fetchNotifications} className="grid size-9 place-items-center rounded-lg hover:bg-[var(--surface-subtle)]"><RefreshCw aria-hidden className="size-4" /></button>
                      </div>
                    </div>
                    <div className="max-h-[22rem] overflow-y-auto p-2">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No notifications yet.</p>
                      ) : notifications.map((item) => (
                        <button key={item.id} type="button" onClick={() => markAsRead(item.id)} className={`flex w-full gap-3 rounded-[10px] px-3 py-3 text-left transition-colors hover:bg-[var(--surface-subtle)] ${item.isRead ? "" : "bg-[var(--brand-subtle)]"}`}>
                          <span className="mt-0.5">{notificationIcon(item.type)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start justify-between gap-3">
                              <span className="text-[0.68rem] font-medium text-[var(--text-secondary)]">{item.type.replace(/_/g, " ").toLowerCase()}</span>
                              <time className="shrink-0 text-[0.68rem] text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                            </span>
                            <span className="mt-1 block text-xs leading-relaxed text-[var(--text-secondary)]">{item.message}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div ref={userRef} className="relative">
                <button type="button" onClick={() => { setShowUserMenu((value) => !value); setShowNotifications(false); }} aria-label="Open user menu" aria-expanded={showUserMenu} aria-controls="user-menu" className="nav-account-button flex h-10 items-center gap-2 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] px-2 sm:px-3">
                  <span className="grid size-7 place-items-center rounded-[7px] bg-[var(--surface-3)] text-xs font-semibold text-[var(--text-secondary)]">{user.name.charAt(0).toUpperCase()}</span>
                  <span className="hidden max-w-24 truncate text-xs font-medium sm:block">{user.name.split(" ")[0]}</span>
                  <ChevronDown aria-hidden className="size-3.5 text-[var(--text-muted)]" />
                </button>
                {showUserMenu && (
                  <div id="user-menu" className="absolute right-0 top-full mt-2 w-56 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-menu)]">
                    <div className="border-b border-[var(--border)] px-3 py-2.5">
                      <p className="truncate text-sm font-bold">{user.name}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
                    </div>
                    <Link href="/settings" onClick={() => setShowUserMenu(false)} className="mt-1 flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"><Settings aria-hidden className="size-4" /> Account settings</Link>
                    <button type="button" onClick={handleLogout} disabled={loading} className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-subtle)]"><LogOut aria-hidden className="size-4" />{loading ? "Signing out…" : "Sign out"}</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2"><Link href="/login" className="btn-ghost">Sign in</Link><Link href="/register" className="btn-primary">Register</Link></div>
          )}
        </div>
      </div>
    </header>
  );
}
