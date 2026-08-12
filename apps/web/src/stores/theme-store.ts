import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Theme } from "@wapp/shared-types";

/**
 * FRD-001 Volume-1 §12/DS-001 §1 — "the app must support OS-level dark mode
 * from day one." FRD-001 Volume-7 — migrated from a local-only
 * `"light"|"dark"|"system"` string union to the real backend `Theme` enum
 * (`@wapp/shared-types`): a genuine, previously-unconsumed `settings/user/theme`
 * endpoint exists, so this is now backend-synced (see `lib/preference-sync.ts`)
 * rather than a purely client-side preference. localStorage persistence stays
 * as a fast-first-paint cache — `hydrateUserPreferences()` overwrites it with
 * the real backend value once a session is established.
 */
export interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: Theme.SYSTEM,
      setTheme: (theme) => set({ theme }),
    }),
    { name: "wapp-web-theme" },
  ),
);
