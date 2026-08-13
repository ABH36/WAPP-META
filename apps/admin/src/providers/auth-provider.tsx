"use client";

import * as React from "react";
import axios from "axios";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { env } from "../lib/env";
import { apiGet } from "../lib/api";
import { useAuthStore } from "../stores/auth-store";
import type { PlatformAccessTokenIssued, PlatformUser } from "../types/auth";

/**
 * FRD-001 Volume-1 §9 — see apps/web's equivalent provider for the full
 * rationale. Uses `/platform/auth/refresh` + `/platform/auth/me`, never the
 * tenant equivalents (ADR-PLAT-002 — fully separate identity boundary).
 *
 * PHD-001 Volume-1 — the refresh cookie is now httpOnly, so JS can no longer
 * check for its presence before attempting a refresh (amends ADR-FE-001).
 * Every fresh load unconditionally attempts one silent refresh; a 401 (no
 * cookie, or an expired/revoked one) simply resolves to `unauthenticated`.
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const setSession = useAuthStore((s) => s.setSession);
  const setStatus = useAuthStore((s) => s.setStatus);

  React.useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      setStatus("loading");
      try {
        const refreshRes = await axios.post<ApiSuccessResponse<PlatformAccessTokenIssued>>(
          `${env.apiUrl}/platform/auth/refresh`,
          undefined,
          { withCredentials: true },
        );
        const tokens = refreshRes.data.data;
        useAuthStore.getState().setAccessToken(tokens.accessToken);

        const user = await apiGet<PlatformUser>("/platform/auth/me");
        if (!cancelled) {
          setSession(user, tokens.accessToken);
        }
      } catch {
        if (!cancelled) {
          setStatus("unauthenticated");
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
