"use client";

import * as React from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { Header } from "@wapp/ui";
import { useAuthStore } from "../../stores/auth-store";
import { useUiStore } from "../../stores/ui-store";
import { useThemeStore } from "../../stores/theme-store";

/**
 * DS-001 §5 — "distinct navigation (no workspace switcher, has tenant search
 * instead), visually distinguished top bar color to prevent an admin ever
 * confusing which console they're in." The `bg-neutral-900` override below
 * is that visual distinction — apps/web's header stays neutral-0/neutral-950
 * (theme-following); this one is deliberately dark regardless of theme, a
 * constant visual signal "this is the Platform console." Tenant search
 * itself (Workspace Search, PRD-007 §4.6) is a later module's job — this
 * establishes the slot.
 */
export function PlatformHeader(): React.JSX.Element {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);

  return (
    <Header
      className="border-neutral-800 bg-neutral-900 dark:border-neutral-800 dark:bg-neutral-900"
      left={
        <>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className="duration-micro rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <span className="text-body-sm font-medium text-neutral-50">
            WAPP Platform Administration
          </span>
        </>
      }
      right={
        <>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="duration-micro rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-800"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" aria-hidden />
            ) : (
              <Moon className="h-5 w-5" aria-hidden />
            )}
          </button>
          {user ? (
            <span className="text-body-sm font-medium text-neutral-300">{user.role}</span>
          ) : null}
        </>
      }
    />
  );
}
