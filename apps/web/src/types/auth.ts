import type { TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";

/**
 * FRD-001 Volume-1 §9 — mirrors `apps/api/src/modules/identity/identity.types.ts`'s
 * `UserProfile`/`AccessTokenIssued` exactly. Not itself importable from
 * `apps/api` (a NestJS app, not a shared package) — enums (`TenantRole`,
 * `WorkspaceMemberStatus`) come from `@wapp/shared-types` (the actual shared
 * source of truth); the response *shape* is mirrored here deliberately.
 * Promoting full request/response DTOs into `@wapp/shared-types` is a
 * larger, separate architectural decision this volume doesn't make.
 */
export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  workspaceId: string | null;
  role: TenantRole | null;
  workspaceMemberStatus: WorkspaceMemberStatus | null;
  isEmailVerified: boolean;
  createdAt: string;
}

/**
 * PHD-001 Volume-1 (Security Hardening) — the only token-related fields ever
 * returned in a client-visible JSON response; the refresh token itself now
 * travels exclusively as an httpOnly Set-Cookie header (amends ADR-FE-001).
 */
export interface AccessTokenIssued {
  accessToken: string;
  expiresIn: number;
}

/** FRD-001 Volume-2 §4.5 — mirrors `SessionSummary` exactly (`identity.types.ts`). No `isCurrent` field — confirmed absent backend-side, Architecture Review 2026-08-10. */
export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

/** FRD-001 Volume-2 §4.6 — mirrors `LoginHistorySummary` exactly. `reason` is one of the backend's own internal strings (`INVALID_CREDENTIALS`, `PLATFORM_MAINTENANCE_MODE`, etc.) — never displayed verbatim, see `lib/login-reason.ts`. */
export interface LoginHistorySummary {
  id: string;
  userId: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
