import React from "react";
import { Globe, CheckCircle2, Info } from "lucide-react";
import { SettingCard } from "./SettingUI";
import { useSettings } from "./SettingsContext";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇬🇧", native: "English" },
  { code: "ms", name: "Malay", flag: "🇲🇾", native: "Bahasa Malaysia" },
  { code: "zh", name: "Chinese (Simplified)", flag: "🇨🇳", native: "简体中文" },
  { code: "zh-tw", name: "Chinese (Traditional)", flag: "🇹🇼", native: "繁體中文" },
  { code: "ta", name: "Tamil", flag: "🇮🇳", native: "தமிழ்" },
  { code: "ja", name: "Japanese", flag: "🇯🇵", native: "日本語" },
];

export function LanguageTab() {
  const { language, setLanguage } = useSettings();

  function handleLanguageChange(code: string) {
    setLanguage(code);
    localStorage.setItem("fyp-language", code);
  }

  return (
    <SettingCard
      title="Language & Region"
      description="Choose your preferred display language"
      icon={<Globe className="w-5 h-5 text-white" />}
    >
      <div className="space-y-3">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Select your preferred language. The interface will adapt accordingly.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200"
              style={{
                border: `1px solid ${language === lang.code ? "var(--accent-primary)" : "var(--border)"}`,
                background: language === lang.code ? "var(--accent-glow)" : "var(--bg-surface)",
              }}
            >
              <span className="text-2xl">{lang.flag}</span>
              <div>
                <p className="text-sm font-bold" style={{ color: language === lang.code ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                  {lang.name}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{lang.native}</p>
              </div>
              {language === lang.code && (
                <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: "var(--accent-primary)" }} />
              )}
            </button>
          ))}
        </div>

        <div
          className="flex items-center gap-2.5 p-3 rounded-xl mt-2"
          style={{ background: "var(--accent-glow)", border: "1px solid var(--border-hover)" }}
        >
          <Info className="w-4 h-4 shrink-0" style={{ color: "var(--accent-secondary)" }} />
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Language preference is saved locally. Full localisation will be available in a future update.
          </p>
        </div>
      </div>
    </SettingCard>
  );
}
