import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./ui-store";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false });
    localStorage.clear();
  });

  it("defaults to expanded (not collapsed)", () => {
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it("toggleSidebar flips the collapsed state", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });

  it("setSidebarCollapsed sets an explicit value", () => {
    useUiStore.getState().setSidebarCollapsed(true);
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
  });
});
