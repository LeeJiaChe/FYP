"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeId = "system" | "dark" | "light" | "ocean" | "forest" | "sunset" | "midnight";
type AppliedThemeId = Exclude<ThemeId, "system">;

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  icon: string;
}

export const THEMES: Theme[] = [
  { id: "system",   name: "System",        description: "Follow the operating-system appearance", icon: "💻" },
  { id: "dark",     name: "Cosmic Dark",   description: "Default deep-space dark theme",        icon: "🌑" },
  { id: "light",    name: "Cloud Light",   description: "Clean bright professional look",        icon: "☀️" },
  { id: "ocean",    name: "Deep Ocean",    description: "Teal & cyan cool ocean tones",          icon: "🌊" },
  { id: "forest",   name: "Forest Mist",   description: "Earthy greens & natural palette",       icon: "🌿" },
  { id: "sunset",   name: "Sunset Glow",   description: "Warm amber & rose gradient tones",      icon: "🌅" },
  { id: "midnight", name: "Midnight Blue", description: "Rich indigo & purple deep blues",       icon: "🌙" },
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("system");

  useEffect(() => {
    const saved = localStorage.getItem("fyp-theme") as ThemeId | null;
    const resolved = saved && THEMES.some((candidate) => candidate.id === saved)
      ? saved
      : "system";
    applyTheme(resolved);
    const synchronizePreference = window.setTimeout(
      () => setThemeState(resolved),
      0,
    );
    return () => window.clearTimeout(synchronizePreference);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme("system");
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, [theme]);

  function setTheme(id: ThemeId) {
    setThemeState(id);
    localStorage.setItem("fyp-theme", id);
    applyTheme(id);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

function applyTheme(id: ThemeId) {
  const root = document.documentElement;
  const applied: AppliedThemeId =
    id === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : id;
  // Remove all theme classes
  root.classList.remove("theme-dark", "theme-light", "theme-ocean", "theme-forest", "theme-sunset", "theme-midnight");
  root.classList.add(`theme-${applied}`);
  root.setAttribute("data-theme", applied);
  root.setAttribute("data-theme-preference", id);
}
