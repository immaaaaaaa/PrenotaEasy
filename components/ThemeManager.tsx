"use client";

import { useEffect } from "react";

export type ThemeMode = "light" | "dark" | "system";

export function getThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem("theme");
  return t === "light" || t === "dark" ? t : "system";
}

export function applyThemeMode(mode: ThemeMode) {
  if (mode === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", mode);
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * Renders nothing: keeps the `dark` class on <html> in sync with the saved
 * preference, and follows the OS theme live when the preference is "system".
 * The first paint is handled by the inline script in the root layout.
 */
export function ThemeManager() {
  useEffect(() => {
    applyThemeMode(getThemeMode());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getThemeMode() === "system") {
        document.documentElement.classList.toggle("dark", mq.matches);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
