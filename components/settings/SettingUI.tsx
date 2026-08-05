import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
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

export function SettingCard({ children, title, description, icon }: {
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

export function SettingRow({ label, description, children }: {
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

export function Alert({ type, message }: { type: "success" | "error"; message: string }) {
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
