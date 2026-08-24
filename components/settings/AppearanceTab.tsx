import React from "react";
import { Moon, Palette, Sun } from "lucide-react";
import { SettingCard } from "./SettingUI";
import { useTheme, type ThemeId } from "@/lib/theme";

export function AppearanceTab() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingCard
      title="Appearance"
      description="Choose Light or Dark mode"
      icon={<Palette className="w-5 h-5 text-white" />}
    >
      <div className="appearance-settings">
        <div>
          <p className="mb-3 text-sm font-bold" style={{ color: "var(--text-primary)" }}>Appearance</p>
          <div className="appearance-options">
            {([
              { id: "light", name: "Light", description: "Bright neutral surfaces", icon: Sun },
              { id: "dark", name: "Dark", description: "Charcoal operational surfaces", icon: Moon },
            ] as const).map((option) => {
              const Icon = option.icon;
              return (
              <button
                key={option.id}
                onClick={() => setTheme(option.id as ThemeId)}
                aria-pressed={theme === option.id}
                className={theme === option.id ? "active" : ""}
              >
                <Icon className="size-5" aria-hidden style={{ color: theme === option.id ? "var(--text)" : "var(--text-muted)" }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{option.name}</p>
                  <p className="mt-1 text-xs leading-snug" style={{ color: "var(--text-muted)" }}>{option.description}</p>
                </div>
              </button>
            )})}
          </div>
        </div>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Motion automatically follows your browser&apos;s reduced-motion preference.
        </p>
      </div>
    </SettingCard>
  );
}
