import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "./theme-store";

describe("useThemeStore (admin)", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "system" });
    localStorage.clear();
  });

  it("defaults to system", () => {
    expect(useThemeStore.getState().theme).toBe("system");
  });

  it("setTheme updates the theme", () => {
    useThemeStore.getState().setTheme("dark");
    expect(useThemeStore.getState().theme).toBe("dark");
  });
});
