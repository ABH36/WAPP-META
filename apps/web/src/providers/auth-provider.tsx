"use client";

import * as React from "react";
import axios from "axios";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { env } from "../lib/env";
import { apiGet } from "../lib/api";
import { hydrateUserPreferences } from "../lib/preference-sync";
import { useAuthStore } from "../stores/auth-store";
import type { AccessTokenIssued, UserProfile } from "../types/auth";

/**
 * FRD-001 Volume-1 §9 — "Session Expiry"/"Role Detection." The access token
 * is memory-only (see stores/auth-store.ts), so every fresh page load starts
 * with an empty store — this provider is what turns "a refresh-token cookie
 * exists" into "the store is hydrated with a real user + access token"
 * before the rest of the app renders, via one silent refresh + `/auth/me`
 * call.
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
        // A raw axios call, not the intercepted `apiClient` — this runs
        // before the store has any access token, and the response
        // interceptor's own refresh logic exists for *later* 401s, not this
        // initial bootstrap. `withCredentials` so the httpOnly cookie is sent.
        const refreshRes = await axios.post<ApiSuccessResponse<AccessTokenIssued>>(
          `${env.apiUrl}/auth/refresh`,
          undefined,
          { withCredentials: true },
        );
        const tokens = refreshRes.data.data;
        useAuthStore.getState().setAccessToken(tokens.accessToken);

        const user = await apiGet<UserProfile>("/auth/me");
        if (!cancelled) {
          setSession(user, tokens.accessToken);
          void hydrateUserPreferences();
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
