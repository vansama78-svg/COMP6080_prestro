export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "presto-theme";

export function readStoredTheme(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") {
      return v;
    }
  } catch {
    /* ignore */
  }
  return "system";
}

export function applyThemePreference(theme: ThemePreference): void {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  if (theme === "light") {
    root.dataset.theme = "light";
  } else if (theme === "dark") {
    root.dataset.theme = "dark";
  }
}

export function initThemeFromStorage(): void {
  applyThemePreference(readStoredTheme());
}
