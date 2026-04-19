import { useEffect, useState } from "react";
import {
  applyThemePreference,
  readStoredTheme,
  type ThemePreference,
  THEME_STORAGE_KEY,
} from "../theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(() => readStoredTheme());

  useEffect(() => {
    applyThemePreference(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== "system" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemePreference("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const cycle = () => {
    setTheme((t) => (t === "system" ? "light" : t === "light" ? "dark" : "system"));
  };

  const label =
    theme === "system" ? "Follow system" : theme === "light" ? "Light theme" : "Dark theme";

  return (
    <button
      aria-label={`${label}. Click to switch appearance.`}
      className="theme-toggle"
      onClick={cycle}
      title={`Appearance: ${label} (click to cycle)`}
      type="button"
    >
      <span aria-hidden className="theme-toggle__icon">
        {theme === "system" ? "◐" : theme === "light" ? "☀" : "☾"}
      </span>
      <span className="theme-toggle__text">
        {theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"}
      </span>
    </button>
  );
}
