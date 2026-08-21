import React from "react";
import { Palette, CheckCircle2 } from "lucide-react";
import { SettingCard } from "./SettingUI";
import { useTheme, THEMES, ThemeId } from "@/lib/theme";

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingCard
      title="Appearance"
      description="Customize the look and feel of the app"
      icon={<Palette className="w-5 h-5 text-white" />}
    >
      <div className="space-y-5">
        <div>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Color Theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as ThemeId)}
                className="flex flex-col items-start gap-2 p-4 rounded-xl text-left transition-all duration-200"
                style={{
                  border: `2px solid ${theme === t.id ? "var(--accent-primary)" : "var(--border)"}`,
                  background: theme === t.id ? "var(--accent-glow)" : "var(--bg-surface)",
                  transform: theme === t.id ? "scale(1.02)" : "scale(1)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.icon}</span>
                  {theme === t.id && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--accent-primary)" }} />}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: theme === t.id ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                    {t.name}
                  </p>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {t.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Motion automatically follows your browser&apos;s reduced-motion preference.
        </p>
      </div>
    </SettingCard>
  );
}
