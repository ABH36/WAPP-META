import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui-store";

describe("useUiStore (admin)", () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    localStorage.clear();
  });

  it("toggleSidebar flips the collapsed state", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });

  it("setSidebarCollapsed sets an explicit value", () => {
    useUiStore.getState().setSidebarCollapsed(true);
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });
});
