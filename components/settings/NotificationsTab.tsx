import React from "react";
import { Bell } from "lucide-react";
import { SettingCard, SettingRow, Toggle } from "./SettingUI";
import { useSettings } from "./SettingsContext";

export function NotificationsTab() {
  const { notifPrefs, setNotifPrefs } = useSettings();

  return (
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
                onChange={() => setNotifPrefs((p: any) => ({ ...p, [key]: !p[key as keyof typeof notifPrefs] }))}
              />
            </SettingRow>
          </div>
        ))}

        <div className="pt-4">
          <SettingRow label="Push Notifications" description="Enable browser push notifications (coming soon)">
            <Toggle checked={notifPrefs.pushEnabled} onChange={() => setNotifPrefs((p: any) => ({ ...p, pushEnabled: !p.pushEnabled }))} />
          </SettingRow>
        </div>
      </div>
    </SettingCard>
  );
}
