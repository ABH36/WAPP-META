"use client";

import * as React from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { Header } from "@wapp/ui";
import { useAuthStore } from "../../stores/auth-store";
import { useUiStore } from "../../stores/ui-store";
import { useThemeStore } from "../../stores/theme-store";

/**
 * FRD-001 Volume-1 §5/§7 — DS-001 §5's "topbar (workspace switcher — future
 * multi-workspace, search, notifications, user menu)". Only the sidebar
 * toggle, theme toggle, and a minimal user-name display are built here —
 * the workspace switcher is explicitly a future-multi-workspace concept
 * DS-001 itself defers, search/notifications have no backend module yet
 * (SDP-001 order), and the full user menu (profile/logout) is the
 * Authentication & Identity UI module's (Volume-2) job. This establishes
 * the structural slot, not the final content.
 */
export function WorkspaceHeader(): React.JSX.Element {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);

  return (
    <Header
      left={
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="duration-micro rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      }
      right={
        <>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="duration-micro rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" aria-hidden />
            ) : (
              <Moon className="h-5 w-5" aria-hidden />
            )}
          </button>
          {user ? (
            <span className="text-body-sm font-medium text-neutral-700 dark:text-neutral-300">
              {user.fullName}
            </span>
          ) : null}
        </>
      }
    />
  );
}
