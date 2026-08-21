import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

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
