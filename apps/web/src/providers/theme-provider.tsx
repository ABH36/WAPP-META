"use client";

import * as React from "react";
import { useThemeStore } from "../stores/theme-store";

/** FRD-001 Volume-1 §6/§12 — applies `.dark` to <html> per DS-001 §2.1 ("darkMode: 'class'" in the shared Tailwind preset). Resolves "system" via `prefers-color-scheme` and keeps it live if the OS theme changes while "system" is selected. */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const theme = useThemeStore((s) => s.theme);

  React.useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (): void => {
      const isDark = theme === "dark" || (theme === "system" && media.matches);
      root.classList.toggle("dark", isDark);
    };

    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    return undefined;
  }, [theme]);

  return <>{children}</>;
}
