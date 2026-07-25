"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useTheme, THEMES, ThemeId } from "@/lib/theme";
import {
  User,
  Lock,
  Globe,
  Bell,
  Palette,
  Shield,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Moon,
  Sun,
  ChevronRight,
  RotateCcw,
  Trash2,
  Download,
  HelpCircle,
  LogOut,
  Info,
} from "lucide-react";

// ─── Language Options ────────────────────────────────────────
const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧", native: "English" },
  { code: "ms", name: "Malay", flag: "🇲🇾", native: "Bahasa Malaysia" },
  { code: "zh", name: "Chinese (Simplified)", flag: "🇨🇳", native: "简体中文" },
  { code: "zh-tw", name: "Chinese (Traditional)", flag: "🇹🇼", native: "繁體中文" },
  { code: "ta", name: "Tamil", flag: "🇮🇳", native: "தமிழ்" },
  { code: "ja", name: "Japanese", flag: "🇯🇵", native: "日本語" },
];

type SettingSection = "profile" | "security" | "language" | "appearance" | "notifications" | "privacy" | "data";

// ─── Toggle Component ─────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="toggle-switch cursor-pointer" onClick={onChange}>
      <div
        className="relative w-12 h-6 rounded-full transition-all duration-300"
        style={{ background: checked ? "var(--accent-primary)" : "var(--border)" }}
      >
        <div
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300"
          style={{ transform: checked ? "translateX(26px)" : "translateX(4px)" }}
        />
      </div>
    </label>
  );
}

// ─── Section Card ─────────────────────────────────────────────
function SettingCard({ children, title, description, icon }: {
  children: React.ReactNode;
  title: string;
  description?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-6 space-y-5 animate-slide-up"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))` }}
        >
          {icon}
        </div>
        <div>
          <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{title}</h2>
          {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────
function SettingRow({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────
function Alert({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className="flex items-center gap-2.5 p-3 rounded-xl text-sm font-medium animate-slide-up"
      style={
        type === "success"
          ? { background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }
          : { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }
      }
    >
      {type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
      {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingSection>("profile");
  const [user, setUser] = useState<any>(null);
  const { theme, setTheme, themes } = useTheme();

  // Profile state
  const [profileForm, setProfileForm] = useState({ name: "", email: "", studentId: "" });
  const [profileAlert, setProfileAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Security state
  const [secForm, setSecForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [secAlert, setSecAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [secLoading, setSecLoading] = useState(false);

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({
    bookingConfirmed: true,
    departureReminder: true,
    waitlistUpdate: true,
    penaltyIssued: true,
    appealResolved: true,
    tripDelayed: true,
    pushEnabled: false,
  });

  // Privacy state
  const [privacyPrefs, setPrivacyPrefs] = useState({
    showProfileToDrivers: true,
    allowAnonymousAnalytics: true,
    twoFactorEnabled: false,
  });

  // Language
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    fetchUser();
    const savedLang = localStorage.getItem("fyp-language") || "en";
    setLanguage(savedLang);
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfileForm({
          name: data.user.name || "",
          email: data.user.email || "",
          studentId: data.user.studentId || "",
        });
      }
    } catch {}
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);
    setProfileAlert(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileForm.name }),
      });
      if (res.ok) {
        setProfileAlert({ type: "success", msg: "Profile updated successfully!" });
        fetchUser();
      } else {
        const d = await res.json();
        setProfileAlert({ type: "error", msg: d.error || "Failed to update profile." });
      }
    } catch {
      setProfileAlert({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (secForm.newPassword !== secForm.confirmPassword) {
      setSecAlert({ type: "error", msg: "New passwords do not match." });
      return;
    }
    if (secForm.newPassword.length < 8) {
      setSecAlert({ type: "error", msg: "Password must be at least 8 characters." });
      return;
    }
    setSecLoading(true);
    setSecAlert(null);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: secForm.currentPassword,
          newPassword: secForm.newPassword,
        }),
      });
      if (res.ok) {
        setSecAlert({ type: "success", msg: "Password changed successfully!" });
        setSecForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        const d = await res.json();
        setSecAlert({ type: "error", msg: d.error || "Failed to change password." });
      }
    } catch {
      setSecAlert({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setSecLoading(false);
    }
  }

  function handleLanguageChange(code: string) {
    setLanguage(code);
    localStorage.setItem("fyp-language", code);
  }

  // Password strength meter
  function getPasswordStrength(password: string) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }
  const pwStrength = getPasswordStrength(secForm.newPassword);
  const pwStrengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][pwStrength] || "";
  const pwStrengthColor = ["", "#f87171", "#fbbf24", "#facc15", "#4ade80", "#22c55e"][pwStrength] || "var(--border)";

  const navItems: { id: SettingSection; label: string; icon: React.ReactNode }[] = [
    { id: "profile",       label: "Profile",       icon: <User className="w-4 h-4" /> },
    { id: "security",      label: "Security",      icon: <Lock className="w-4 h-4" /> },
    { id: "language",      label: "Language",      icon: <Globe className="w-4 h-4" /> },
    { id: "appearance",    label: "Appearance",    icon: <Palette className="w-4 h-4" /> },
    { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "privacy",       label: "Privacy",       icon: <Shield className="w-4 h-4" /> },
    { id: "data",          label: "Data & Account",icon: <Download className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="section-title">Personal Settings</h1>
          <p className="section-subtitle">Manage your profile, preferences, and account security</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Sidebar Navigation ── */}
          <aside className="lg:w-60 shrink-0">
            <div
              className="rounded-2xl p-3 space-y-1 sticky top-24"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              {/* User Avatar */}
              <div className="flex items-center gap-3 px-3 py-3 mb-2 border-b" style={{ borderColor: "var(--border)" }}>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))` }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{user?.name || "Loading..."}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{user?.role || ""}</p>
                </div>
              </div>

              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="settings-nav-item"
                  style={
                    activeSection === item.id
                      ? {
                          background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))`,
                          color: "white",
                          boxShadow: `0 4px 15px var(--accent-glow)`,
                        }
                      : {}
                  }
                >
                  {item.icon}
                  {item.label}
                  {activeSection !== item.id && <ChevronRight className="w-3.5 h-3.5 ml-auto" style={{ color: "var(--text-muted)" }} />}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Main Content ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* PROFILE */}
            {activeSection === "profile" && (
              <SettingCard
                title="Profile Information"
                description="Update your personal details and display name"
                icon={<User className="w-5 h-5 text-white" />}
              >
                <form onSubmit={handleProfileSave} className="space-y-4">
                  {profileAlert && <Alert type={profileAlert.type} message={profileAlert.msg} />}

                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-2xl"
                      style={{ background: `linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))` }}
                    >
                      {profileForm.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{profileForm.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{profileForm.email}</p>
                      {user?.studentId && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--accent-secondary)" }}>Student ID: {user.studentId}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Full Name</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="input-field"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      readOnly
                      className="input-field opacity-60 cursor-not-allowed"
                    />
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>Email cannot be changed after registration.</p>
                  </div>

                  {user?.studentId && (
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>Student ID</label>
                      <input
                        type="text"
                        value={profileForm.studentId}
                        readOnly
                        className="input-field opacity-60 cursor-not-allowed"
                      />
                    </div>
                  )}

                  {user?.role === "STUDENT" && (
                    <div
                      className="p-4 rounded-xl"
                      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>Credit Score</span>
                        <span className="text-lg font-extrabold" style={{ color: (user?.creditScore ?? 100) < 40 ? "#f87171" : "#4ade80" }}>
                          {user?.creditScore ?? 100} / 100
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${user?.creditScore ?? 100}%`,
                            background: (user?.creditScore ?? 100) < 40
                              ? "linear-gradient(90deg, #ef4444, #f87171)"
                              : "linear-gradient(90deg, var(--accent-primary), #4ade80)",
                          }}
                        />
                      </div>
                      {user?.isBookingRestricted && (
                        <p className="text-[11px] mt-2 font-semibold" style={{ color: "#f87171" }}>
                          ⚠ Booking privileges currently restricted.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn-primary flex items-center gap-2"
                      disabled={profileLoading}
                    >
                      <Save className="w-4 h-4" />
                      {profileLoading ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </SettingCard>
            )}

            {/* SECURITY */}
            {activeSection === "security" && (
              <SettingCard
                title="Security Settings"
                description="Change your password and manage account security"
                icon={<Lock className="w-5 h-5 text-white" />}
              >
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {secAlert && <Alert type={secAlert.type} message={secAlert.msg} />}

                  {(["current", "new", "confirm"] as const).map((field) => {
                    const labels = { current: "Current Password", new: "New Password", confirm: "Confirm New Password" };
                    const keys = { current: "currentPassword", new: "newPassword", confirm: "confirmPassword" } as const;
                    const showKey = field;
                    return (
                      <div key={field}>
                        <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                          {labels[field]}
                        </label>
                        <div className="relative">
                          <input
                            type={showPasswords[showKey] ? "text" : "password"}
                            value={secForm[keys[field]]}
                            onChange={(e) => setSecForm({ ...secForm, [keys[field]]: e.target.value })}
                            className="input-field pr-10"
                            placeholder="••••••••"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPasswords({ ...showPasswords, [showKey]: !showPasswords[showKey] })}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {showPasswords[showKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {/* Password strength for new password */}
                        {field === "new" && secForm.newPassword && (
                          <div className="mt-2 space-y-1">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                  key={i}
                                  className="h-1.5 flex-1 rounded-full transition-all duration-300"
                                  style={{ background: i <= pwStrength ? pwStrengthColor : "var(--border)" }}
                                />
                              ))}
                            </div>
                            <p className="text-[11px] font-semibold" style={{ color: pwStrengthColor }}>
                              {pwStrengthLabel}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Password Requirements */}
                  <div
                    className="p-3 rounded-xl space-y-1.5"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  >
                    <p className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>Password Requirements</p>
                    {[
                      { label: "At least 8 characters", met: secForm.newPassword.length >= 8 },
                      { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(secForm.newPassword) },
                      { label: "One number (0-9)", met: /[0-9]/.test(secForm.newPassword) },
                      { label: "One special character (!@#...)", met: /[^A-Za-z0-9]/.test(secForm.newPassword) },
                    ].map((req) => (
                      <div key={req.label} className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ background: req.met ? "rgba(34,197,94,0.2)" : "var(--border)" }}
                        >
                          {req.met ? (
                            <CheckCircle2 className="w-3 h-3" style={{ color: "#4ade80" }} />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--text-muted)" }} />
                          )}
                        </div>
                        <span className="text-[11px]" style={{ color: req.met ? "#4ade80" : "var(--text-muted)" }}>{req.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <button type="submit" className="btn-primary flex items-center gap-2" disabled={secLoading}>
                      <Shield className="w-4 h-4" />
                      {secLoading ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>

                {/* Active Sessions */}
                <div className="mt-6 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Active Sessions</h3>
                  <div
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4" style={{ color: "var(--accent-secondary)" }} />
                      <div>
                        <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Current Session</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          Browser • {new Date().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-green">Active</span>
                  </div>
                </div>
              </SettingCard>
            )}

            {/* LANGUAGE */}
            {activeSection === "language" && (
              <SettingCard
                title="Language & Region"
                description="Choose your preferred display language"
                icon={<Globe className="w-5 h-5 text-white" />}
              >
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Select your preferred language. The interface will adapt accordingly.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageChange(lang.code)}
                        className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200"
                        style={{
                          border: `1px solid ${language === lang.code ? "var(--accent-primary)" : "var(--border)"}`,
                          background: language === lang.code ? "var(--accent-glow)" : "var(--bg-surface)",
                        }}
                      >
                        <span className="text-2xl">{lang.flag}</span>
                        <div>
                          <p className="text-sm font-bold" style={{ color: language === lang.code ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                            {lang.name}
                          </p>
                          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lang.native}</p>
                        </div>
                        {language === lang.code && (
                          <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: "var(--accent-primary)" }} />
                        )}
                      </button>
                    ))}
                  </div>

                  <div
                    className="flex items-center gap-2.5 p-3 rounded-xl mt-2"
                    style={{ background: "var(--accent-glow)", border: "1px solid var(--border-hover)" }}
                  >
                    <Info className="w-4 h-4 shrink-0" style={{ color: "var(--accent-secondary)" }} />
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Language preference is saved locally. Full localisation will be available in a future update.
                    </p>
                  </div>
                </div>
              </SettingCard>
            )}

            {/* APPEARANCE */}
            {activeSection === "appearance" && (
              <SettingCard
                title="Appearance"
                description="Customize the look and feel of the app"
                icon={<Palette className="w-5 h-5 text-white" />}
              >
                <div className="space-y-5">
                  <div>
                    <p className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Color Theme</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id as ThemeId)}
                          className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all duration-200"
                          style={{
                            border: `2px solid ${theme === t.id ? "var(--accent-primary)" : "var(--border)"}`,
                            background: theme === t.id ? "var(--accent-glow)" : "var(--bg-surface)",
                            transform: theme === t.id ? "scale(1.02)" : "scale(1)",
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{t.icon}</span>
                            {theme === t.id && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--accent-primary)" }} />}
                          </div>
                          <div>
                            <p className="text-xs font-bold" style={{ color: theme === t.id ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                              {t.name}
                            </p>
                            <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {t.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Display Preferences</p>
                    <SettingRow label="Compact Mode" description="Reduce spacing for more content">
                      <Toggle checked={false} onChange={() => {}} />
                    </SettingRow>
                    <SettingRow label="Reduce Animations" description="Minimize motion for accessibility">
                      <Toggle checked={false} onChange={() => {}} />
                    </SettingRow>
                    <SettingRow label="High Contrast" description="Enhance text visibility">
                      <Toggle checked={false} onChange={() => {}} />
                    </SettingRow>
                  </div>
                </div>
              </SettingCard>
            )}

            {/* NOTIFICATIONS */}
            {activeSection === "notifications" && (
              <SettingCard
                title="Notification Preferences"
                description="Control which alerts and updates you receive"
                icon={<Bell className="w-5 h-5 text-white" />}
              >
                <div className="space-y-1">
                  {[
                    { key: "bookingConfirmed", label: "Booking Confirmed", desc: "When your seat booking is confirmed" },
                    { key: "departureReminder", label: "Departure Reminder", desc: "30-minute reminder before your bus departs" },
                    { key: "waitlistUpdate", label: "Waitlist Promoted", desc: "When you move up from the waitlist" },
                    { key: "penaltyIssued", label: "Penalty Issued", desc: "When a credit penalty is applied to your account" },
                    { key: "appealResolved", label: "Appeal Resolved", desc: "When your penalty appeal is reviewed" },
                    { key: "tripDelayed", label: "Trip Delayed", desc: "When your booked trip is delayed" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="py-3 border-b" style={{ borderColor: "var(--border)" }}>
                      <SettingRow label={label} description={desc}>
                        <Toggle
                          checked={notifPrefs[key as keyof typeof notifPrefs] as boolean}
                          onChange={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key as keyof typeof notifPrefs] }))}
                        />
                      </SettingRow>
                    </div>
                  ))}

                  <div className="pt-4">
                    <SettingRow label="Push Notifications" description="Enable browser push notifications (coming soon)">
                      <Toggle checked={notifPrefs.pushEnabled} onChange={() => setNotifPrefs((p) => ({ ...p, pushEnabled: !p.pushEnabled }))} />
                    </SettingRow>
                  </div>
                </div>
              </SettingCard>
            )}

            {/* PRIVACY */}
            {activeSection === "privacy" && (
              <SettingCard
                title="Privacy & Security"
                description="Manage your data sharing and account visibility settings"
                icon={<Shield className="w-5 h-5 text-white" />}
              >
                <div className="space-y-1">
                  <SettingRow
                    label="Profile visible to Drivers"
                    description="Drivers can see your name for check-in verification"
                  >
                    <Toggle
                      checked={privacyPrefs.showProfileToDrivers}
                      onChange={() => setPrivacyPrefs((p) => ({ ...p, showProfileToDrivers: !p.showProfileToDrivers }))}
                    />
                  </SettingRow>
                  <div className="border-t" style={{ borderColor: "var(--border)" }} />
                  <SettingRow
                    label="Anonymous Analytics"
                    description="Help improve the system with anonymous usage data"
                  >
                    <Toggle
                      checked={privacyPrefs.allowAnonymousAnalytics}
                      onChange={() => setPrivacyPrefs((p) => ({ ...p, allowAnonymousAnalytics: !p.allowAnonymousAnalytics }))}
                    />
                  </SettingRow>
                  <div className="border-t" style={{ borderColor: "var(--border)" }} />
                  <SettingRow
                    label="Two-Factor Authentication"
                    description="Add an extra layer of security (coming soon)"
                  >
                    <Toggle
                      checked={privacyPrefs.twoFactorEnabled}
                      onChange={() => setPrivacyPrefs((p) => ({ ...p, twoFactorEnabled: !p.twoFactorEnabled }))}
                    />
                  </SettingRow>
                </div>

                <div
                  className="mt-4 p-3 rounded-xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-secondary)" }}>Last Login</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} — Current Session
                  </p>
                </div>
              </SettingCard>
            )}

            {/* DATA & ACCOUNT */}
            {activeSection === "data" && (
              <SettingCard
                title="Data & Account Management"
                description="Export your data, manage account preferences, or delete your account"
                icon={<Download className="w-5 h-5 text-white" />}
              >
                <div className="space-y-4">
                  <div
                    className="p-4 rounded-xl space-y-3"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  >
                    <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Your Data</h3>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Download a copy of all your booking history, penalties, and account information.
                    </p>
                    <button className="btn-ghost flex items-center gap-2 text-xs">
                      <Download className="w-4 h-4" />
                      Export My Data (JSON)
                    </button>
                  </div>

                  <div
                    className="p-4 rounded-xl space-y-3"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  >
                    <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Account Actions</h3>
                    <div className="space-y-2">
                      <button className="btn-ghost flex items-center gap-2 text-xs w-full">
                        <RotateCcw className="w-4 h-4" />
                        Reset Notification Preferences
                      </button>
                      <button className="btn-ghost flex items-center gap-2 text-xs w-full">
                        <HelpCircle className="w-4 h-4" />
                        Contact Support
                      </button>
                    </div>
                  </div>

                  <div
                    className="p-4 rounded-xl space-y-3"
                    style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    <h3 className="text-sm font-bold" style={{ color: "#f87171" }}>Danger Zone</h3>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Deleting your account is irreversible. All your bookings, history, and data will be permanently removed.
                    </p>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200"
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete My Account
                    </button>
                  </div>
                </div>
              </SettingCard>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
