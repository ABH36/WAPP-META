import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

/** FRD-001 Volume-1 §12/DS-001 §1 — "the app must support OS-level dark mode from day one." Pure UI preference, safe to persist to localStorage (no auth/business-state implication). */
export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "wapp-web-theme" },
  ),
);
