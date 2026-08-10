"use client";

import * as React from "react";
import { useThemeStore } from "../stores/theme-store";

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
