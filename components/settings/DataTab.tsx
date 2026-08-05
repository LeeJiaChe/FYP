import React from "react";
import { Download, RotateCcw, HelpCircle, Trash2 } from "lucide-react";
import { SettingCard } from "./SettingUI";

export function DataTab() {
  return (
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
  );
}
