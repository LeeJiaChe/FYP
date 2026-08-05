import React from "react";
import { Shield } from "lucide-react";
import { SettingCard, SettingRow, Toggle } from "./SettingUI";
import { useSettings } from "./SettingsContext";

export function PrivacyTab() {
  const { privacyPrefs, setPrivacyPrefs } = useSettings();

  return (
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
            onChange={() => setPrivacyPrefs((p: any) => ({ ...p, showProfileToDrivers: !p.showProfileToDrivers }))}
          />
        </SettingRow>
        <div className="border-t" style={{ borderColor: "var(--border)" }} />
        <SettingRow
          label="Anonymous Analytics"
          description="Help improve the system with anonymous usage data"
        >
          <Toggle
            checked={privacyPrefs.allowAnonymousAnalytics}
            onChange={() => setPrivacyPrefs((p: any) => ({ ...p, allowAnonymousAnalytics: !p.allowAnonymousAnalytics }))}
          />
        </SettingRow>
        <div className="border-t" style={{ borderColor: "var(--border)" }} />
        <SettingRow
          label="Two-Factor Authentication"
          description="Add an extra layer of security (coming soon)"
        >
          <Toggle
            checked={privacyPrefs.twoFactorEnabled}
            onChange={() => setPrivacyPrefs((p: any) => ({ ...p, twoFactorEnabled: !p.twoFactorEnabled }))}
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
  );
}
