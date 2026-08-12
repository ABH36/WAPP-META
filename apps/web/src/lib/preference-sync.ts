import { SidebarState, type Theme, type UiDensity } from "@wapp/shared-types";
import { userPreferencesService } from "../services/user-preferences.service";
import { useThemeStore } from "../stores/theme-store";
import { useUiStore } from "../stores/ui-store";

/**
 * FRD-001 Volume-7 — migrates Theme/Sidebar/Density off local-only
 * `theme-store.ts`/`ui-store.ts` onto the real, previously-unconsumed
 * `settings/user/*` backend (Architecture Review, 2026-08-12: "Cross-device
 * persistence is now the authoritative behaviour"). All calls here are
 * best-effort — a failed sync (offline, expired session) leaves the local
 * Zustand state as the fallback, never blocks the UI interaction that
 * triggered it.
 */

/** Called once a session is established (fresh login or silent-refresh hydration) — overwrites local/cached state with the real backend value. */
export async function hydrateUserPreferences(): Promise<void> {
  try {
    const overview = await userPreferencesService.overview();
    useThemeStore.getState().setTheme(overview.theme);
    useUiStore.getState().setSidebarCollapsed(overview.sidebar === SidebarState.COLLAPSED);
    useUiStore.getState().setDensity(overview.density);
  } catch {
    // Best-effort — local defaults/cache stay in place.
  }
}

export function syncTheme(theme: Theme): void {
  void userPreferencesService.updateTheme({ theme }).catch(() => {
    // Best-effort — the local store already reflects the user's choice.
  });
}

export function syncSidebar(collapsed: boolean): void {
  void userPreferencesService
    .updateTheme({ sidebar: collapsed ? SidebarState.COLLAPSED : SidebarState.EXPANDED })
    .catch(() => {
      // Best-effort — the local store already reflects the user's choice.
    });
}

export function syncDensity(density: UiDensity): void {
  void userPreferencesService.updateTheme({ density }).catch(() => {
    // Best-effort — the local store already reflects the user's choice.
  });
}
