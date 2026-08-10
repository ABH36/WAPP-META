import { create } from "zustand";
import type { UserProfile } from "../types/auth";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

/**
 * FRD-001 Volume-1 §9/§12 — deliberately NOT persisted (no zustand `persist`
 * middleware). The access token lives in memory only and is re-derived on
 * every page load via a silent refresh (see providers/auth-provider.tsx) —
 * the refresh token itself is what survives a reload, mirrored into a cookie
 * (see lib/cookies.ts) rather than kept in this store. BR-005 ("Frontend
 * state never replaces backend state") — this store is a cache of the
 * backend's session state, not an independent source of truth.
 */
export interface AuthState {
  status: AuthStatus;
  user: UserProfile | null;
  accessToken: string | null;
  setSession: (user: UserProfile, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  user: null,
  accessToken: null,
  setSession: (user, accessToken) => set({ user, accessToken, status: "authenticated" }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setStatus: (status) => set({ status }),
  clear: () => set({ user: null, accessToken: null, status: "unauthenticated" }),
}));
