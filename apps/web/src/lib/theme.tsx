"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { THEMES, THEME_STORAGE_KEY, type ResolvedTheme, type ThemePreference } from "./theme-script";

/**
 * Theme preference: three built-in looks plus "system", which follows the OS
 * light/dark setting. The resolved theme lives on <html data-theme>.
 */
export { THEMES, type ThemePreference, type ResolvedTheme };

/** Browser chrome colour (meta theme-color) per resolved theme */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: "#0a0a0f",
  light: "#f3f5f8",
  ocean: "#001e27",
};

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function apply(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme !== "light");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  // Read the saved preference after mount (the inline script already applied it)
  useEffect(() => {
    let saved: ThemePreference = "system";
    try {
      const value = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
      if (value && (THEMES as readonly string[]).includes(value)) saved = value;
    } catch {
      /* storage unavailable */
    }
    setPreferenceState(saved);
  }, []);

  // Apply + follow OS changes while on "system"
  useEffect(() => {
    const update = () => {
      const theme = resolve(preference);
      setResolved(theme);
      apply(theme);
    };
    update();
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [preference]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
