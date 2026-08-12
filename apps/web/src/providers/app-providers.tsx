"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";
import { PwaManager } from "../components/pwa-manager";

/**
 * FRD-001 Volume-1 §12 — single composition root for every global provider,
 * mounted once in the root layout. Order matters: Query before Auth (auth
 * hydration issues queries indirectly via later hooks), Theme can wrap
 * either side since it has no data dependency. `PwaManager` (FRD-001
 * Volume-9, apps/web only) is headless — it only needs the `Toaster`
 * mounted alongside it, no ordering dependency on Query/Theme/Auth.
 */
export function AppProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
          <PwaManager />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
