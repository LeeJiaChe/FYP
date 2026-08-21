"use client";

import React, { createContext, useContext, useState } from "react";
import type { CurrentUser } from "@/shared/ui/current-user";

export type SettingSection = "profile" | "security" | "appearance";

interface SettingsContextType {
  activeSection: SettingSection;
  setActiveSection: (s: SettingSection) => void;
  user: CurrentUser;
  fetchUser: () => Promise<void>;
  
  // Profile
  profileForm: { name: string; email: string; studentId: string };
  setProfileForm: (val: any) => void;
  profileAlert: { type: "success" | "error"; msg: string } | null;
  setProfileAlert: (val: any) => void;
  profileLoading: boolean;
  setProfileLoading: (val: boolean) => void;

  // Security
  secForm: { currentPassword: string; newPassword: string; confirmPassword: string; };
  setSecForm: (val: any) => void;
  secAlert: { type: "success" | "error"; msg: string } | null;
  setSecAlert: (val: any) => void;
  secLoading: boolean;
  setSecLoading: (val: boolean) => void;

}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children, initialUser }: { children: React.ReactNode; initialUser: CurrentUser }) {
  const [activeSection, setActiveSection] = useState<SettingSection>("profile");
  const [user, setUser] = useState<CurrentUser>(initialUser);

  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: initialUser.name,
    email: initialUser.email,
    studentId: initialUser.studentId || "",
  });
  const [profileAlert, setProfileAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Security state
  const [secForm, setSecForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [secAlert, setSecAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [secLoading, setSecLoading] = useState(false);

  async function fetchUser() {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return;
    const data = await res.json();
    setUser(data.user);
    setProfileForm({
      name: data.user.name || "",
      email: data.user.email || "",
      studentId: data.user.studentId || "",
    });
  }

  return (
    <SettingsContext.Provider
      value={{
        activeSection, setActiveSection,
        user, fetchUser,
        profileForm, setProfileForm,
        profileAlert, setProfileAlert,
        profileLoading, setProfileLoading,
        secForm, setSecForm,
        secAlert, setSecAlert,
        secLoading, setSecLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
