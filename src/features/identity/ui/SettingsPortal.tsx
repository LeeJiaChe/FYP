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
    <div className="settings-shell">
      <Navbar initialUser={user} />

      <main id="main-content" className="settings-content">
        <header className="settings-page-header">
          <h1 className="section-title">Personal Settings</h1>
          <p className="section-subtitle">Manage your profile, preferences, and account security</p>
        </header>

        <div className="settings-workspace">
          <aside className="settings-sidebar">
            <div className="settings-navigation">
              <div className="settings-identity">
                <div className="settings-avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div>
                  <strong>{user?.name || "Loading..."}</strong>
                  <small>{user?.role || ""}</small>
                </div>
              </div>

              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className="settings-nav-item"
                  aria-current={activeSection === item.id ? "page" : undefined}
                >
                  {item.icon}
                  {item.label}
                  {activeSection !== item.id && <ChevronRight aria-hidden />}
                </button>
              ))}
            </div>
          </aside>

          <div className="settings-detail">
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
