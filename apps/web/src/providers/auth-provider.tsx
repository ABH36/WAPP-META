"use client";

import * as React from "react";
import axios from "axios";
import { getCookie, setCookie } from "@wapp/ui";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { env } from "../lib/env";
import { REFRESH_TOKEN_COOKIE, apiGet } from "../lib/api";
import { refreshTokenCookieMaxAge } from "../lib/remember-me";
import { useAuthStore } from "../stores/auth-store";
import type { IssuedTokenPair, UserProfile } from "../types/auth";

/**
 * FRD-001 Volume-1 §9 — "Session Expiry"/"Role Detection." The access token
 * is memory-only (see stores/auth-store.ts), so every fresh page load starts
 * with an empty store — this provider is what turns "a refresh-token cookie
 * exists" into "the store is hydrated with a real user + access token"
 * before the rest of the app renders, via one silent refresh + `/auth/me`
 * call. If there's no cookie, or the refresh fails, status becomes
 * `unauthenticated` immediately — no network call is attempted.
 */
export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const setSession = useAuthStore((s) => s.setSession);
  const setStatus = useAuthStore((s) => s.setStatus);

  React.useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      const refreshToken = getCookie(REFRESH_TOKEN_COOKIE);
      if (!refreshToken) {
        setStatus("unauthenticated");
        return;
      }

      setStatus("loading");
      try {
        // A raw axios call, not the intercepted `apiClient` — this runs
        // before the store has any access token, and the response
        // interceptor's own refresh logic exists for *later* 401s, not this
        // initial bootstrap.
        const refreshRes = await axios.post<ApiSuccessResponse<IssuedTokenPair>>(
          `${env.apiUrl}/auth/refresh`,
          { refreshToken },
        );
        const tokens = refreshRes.data.data;
        setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshTokenCookieMaxAge());
        useAuthStore.getState().setAccessToken(tokens.accessToken);

        const user = await apiGet<UserProfile>("/auth/me");
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
