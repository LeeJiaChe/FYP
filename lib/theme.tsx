"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

export type ThemeId = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: ReactNode;
  initialTheme?: ThemeId;
}) {
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);

  function setTheme(nextTheme: ThemeId) {
    setThemeState(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("theme-dark", nextTheme === "dark");
    document.documentElement.classList.toggle("theme-light", nextTheme === "light");
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", nextTheme === "dark" ? "#0b0e12" : "#f3f1ed");
    localStorage.setItem("fyp-theme", nextTheme);
    document.cookie = `fyp-theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fyp-theme");
      if (saved === "light" || saved === "dark") {
        if (saved !== theme) {
          setTheme(saved);
        }
      }
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
