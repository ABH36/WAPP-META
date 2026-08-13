import type { PlatformRole } from "@wapp/shared-types";

/**
 * FRD-001 Volume-1 §9 — mirrors `apps/api/src/modules/platform/platform.types.ts`.
 * A real backend asymmetry, worth being deliberate about (see
 * docs/ADR-FE-001-frontend-architecture.md): `POST /platform/auth/login`
 * returns a full `PlatformUserProfile` (fullName/email/isActive/...), but
 * `GET /platform/auth/me` (the endpoint the silent-refresh hydration flow
 * uses on every page load) returns only the JWT claims —
 * `{platformUserId, role}`. Rather than show a fuller profile after login
 * than after a reload, this app treats the *thin* shape as the canonical
 * `PlatformUser` type everywhere — consistent, if less detailed, across
 * both flows. No backend change is authorized as part of this volume to
 * close that gap.
 */
export interface PlatformUser {
  platformUserId: string;
  role: PlatformRole;
}

/** The fuller shape only `POST /platform/auth/login` returns — see this file's top comment for why the store itself uses the thinner `PlatformUser` instead. */
export interface PlatformUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: PlatformRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * PHD-001 Volume-1 (Security Hardening) — the only token-related fields ever
 * returned in a client-visible JSON response; the refresh token itself now
 * travels exclusively as an httpOnly Set-Cookie header (amends ADR-FE-001).
 */
export interface PlatformAccessTokenIssued {
  accessToken: string;
  expiresIn: number;
}
