"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeId = "dark" | "light" | "ocean" | "forest" | "sunset" | "midnight";

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  icon: string;
}

export const THEMES: Theme[] = [
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
  theme: "dark",
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("fyp-theme") as ThemeId | null;
    if (saved && THEMES.find((t) => t.id === saved)) {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      applyTheme("dark");
    }
  }, []);

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
  // Remove all theme classes
  root.classList.remove("theme-dark", "theme-light", "theme-ocean", "theme-forest", "theme-sunset", "theme-midnight");
  root.classList.add(`theme-${id}`);
  root.setAttribute("data-theme", id);
}
