import { create } from "zustand";
import { persist } from "zustand/middleware";

/** FRD-001 Volume-1 §12 — "Sidebar" as global state. Pure UI preference (collapsed/expanded), persisted so it survives a reload. Notifications state is deliberately not modeled here yet — no Notification module exists on the backend (SDP-001 module order), so there's nothing real to back it with; add it when that module lands, not before. */
export interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    }),
    { name: "wapp-web-ui" },
  ),
);
