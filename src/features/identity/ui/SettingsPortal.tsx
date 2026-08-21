"use client";

import React from "react";
import Navbar from "@/components/Navbar";
import { User, Lock, Palette, ChevronRight } from "lucide-react";

import { SettingsProvider, useSettings, SettingSection } from "@/components/settings/SettingsContext";
import { ProfileTab } from "@/components/settings/ProfileTab";
import { SecurityTab } from "@/components/settings/SecurityTab";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import type { CurrentUser } from "@/shared/ui/current-user";

const navItems: { id: SettingSection; label: string; icon: React.ReactNode }[] = [
  { id: "profile",       label: "Profile",       icon: <User className="w-4 h-4" /> },
  { id: "security",      label: "Security",      icon: <Lock className="w-4 h-4" /> },
  { id: "appearance",    label: "Appearance",    icon: <Palette className="w-4 h-4" /> },
];

function SettingsContent() {
  const { activeSection, setActiveSection, user } = useSettings();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <Navbar initialUser={user} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="section-title">Personal Settings</h1>
          <p className="section-subtitle">Manage your profile, preferences, and account security</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-60 shrink-0">
            <div
              className="rounded-2xl p-3 space-y-1 sticky top-24"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
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

          <div className="flex-1 min-w-0 space-y-5">
            {activeSection === "profile" && <ProfileTab />}
            {activeSection === "security" && <SecurityTab />}
            {activeSection === "appearance" && <AppearanceTab />}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPortal({ initialUser }: { initialUser: CurrentUser }) {
  return (
    <SettingsProvider initialUser={initialUser}>
      <SettingsContent />
    </SettingsProvider>
  );
}
