import { describe, it, expect, beforeEach } from "vitest";
import { Theme } from "@wapp/shared-types";
import { useThemeStore } from "./theme-store";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: Theme.SYSTEM });
    localStorage.clear();
  });

  it("defaults to system", () => {
    expect(useThemeStore.getState().theme).toBe(Theme.SYSTEM);
  });

  it("setTheme updates the theme", () => {
    useThemeStore.getState().setTheme(Theme.DARK);
    expect(useThemeStore.getState().theme).toBe(Theme.DARK);
  });

  it.each([Theme.LIGHT, Theme.DARK, Theme.SYSTEM])("accepts %s as a valid theme", (theme) => {
    useThemeStore.getState().setTheme(theme);
    expect(useThemeStore.getState().theme).toBe(theme);
  });
});
