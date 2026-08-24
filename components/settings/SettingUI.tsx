import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function SettingCard({ children, title, description, icon }: {
  children: React.ReactNode;
  title: string;
  description?: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="setting-section animate-slide-up">
      <header className="setting-section-header">
        <span>
          {icon}
        </span>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Alert({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div className={`settings-alert ${type}`} role={type === "error" ? "alert" : "status"}>
      {type === "success" ? <CheckCircle2 aria-hidden /> : <AlertTriangle aria-hidden />}
      {message}
    </div>
  );
}
