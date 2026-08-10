"use client";

import * as React from "react";
import axios from "axios";
import { getCookie, setCookie } from "@wapp/ui";
import type { ApiSuccessResponse } from "@wapp/shared-types";
import { env } from "../lib/env";
import { REFRESH_TOKEN_COOKIE, apiGet } from "../lib/api";
import { refreshTokenCookieMaxAge } from "../lib/remember-me";
import { useAuthStore } from "../stores/auth-store";
import type { IssuedPlatformTokenPair, PlatformUser } from "../types/auth";

/** FRD-001 Volume-1 §9 — see apps/web's equivalent provider for the full rationale. Uses `/platform/auth/refresh` + `/platform/auth/me`, never the tenant equivalents (ADR-PLAT-002 — fully separate identity boundary). */
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
        const refreshRes = await axios.post<ApiSuccessResponse<IssuedPlatformTokenPair>>(
          `${env.apiUrl}/platform/auth/refresh`,
          { refreshToken },
        );
        const tokens = refreshRes.data.data;
        setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshTokenCookieMaxAge());
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
