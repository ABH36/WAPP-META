"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./auth-provider";

/** FRD-001 Volume-1 §12 — single composition root for every global provider, mounted once in the root layout. Order matters: Query before Auth (auth hydration issues queries indirectly via later hooks), Theme can wrap either side since it has no data dependency. */
export function AppProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          {children}
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
