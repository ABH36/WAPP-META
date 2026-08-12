import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UiDensity } from "@wapp/shared-types";

/**
 * FRD-001 Volume-1 §12 — "Sidebar" as global state. FRD-001 Volume-7 —
 * `density` is new: the real backend `settings/user/theme` endpoint carries
 * `density` alongside `theme`/`sidebar`, so this store gained a field to
 * mirror it (`lib/preference-sync.ts` handles hydration/write-through for
 * all three together). `sidebarCollapsed` stays a plain boolean (not the
 * backend's `SidebarState` enum) — the conversion happens only at the
 * service-call boundary, since every existing consumer already expects a
 * boolean and there's no benefit to threading the enum through this store.
 */
export interface UiState {
  sidebarCollapsed: boolean;
  density: UiDensity;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDensity: (density: UiDensity) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: UiDensity.COMFORTABLE,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setDensity: (density) => set({ density }),
    }),
    { name: "wapp-web-ui" },
  ),
);
