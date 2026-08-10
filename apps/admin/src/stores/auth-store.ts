import { create } from "zustand";
import type { PlatformUser } from "../types/auth";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

/** FRD-001 Volume-1 §9/§12 — see apps/web's equivalent store for the full rationale (memory-only access token, cookie-mirrored refresh token). Genuinely separate identity boundary from apps/web (ADR-PLAT-002) — this store, its cookie name, and its API calls never intersect with apps/web's. */
export interface AuthState {
  status: AuthStatus;
  user: PlatformUser | null;
  accessToken: string | null;
  setSession: (user: PlatformUser, accessToken: string) => void;
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
