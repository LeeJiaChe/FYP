"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import toast from "react-hot-toast";

export type SettingSection = "profile" | "security" | "language" | "appearance" | "notifications" | "privacy" | "data";

interface SettingsContextType {
  activeSection: SettingSection;
  setActiveSection: (s: SettingSection) => void;
  user: any;
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

  // Notification prefs state
  notifPrefs: any;
  setNotifPrefs: (val: any) => void;

  // Privacy state
  privacyPrefs: any;
  setPrivacyPrefs: (val: any) => void;

  // Language
  language: string;
  setLanguage: (val: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState<SettingSection>("profile");
  const [user, setUser] = useState<any>(null);

  // Profile state
  const [profileForm, setProfileForm] = useState({ name: "", email: "", studentId: "" });
  const [profileAlert, setProfileAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Security state
  const [secForm, setSecForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
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
    } catch (err: any) { toast.error(err.message || "An error occurred"); }
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
        notifPrefs, setNotifPrefs,
        privacyPrefs, setPrivacyPrefs,
        language, setLanguage,
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
