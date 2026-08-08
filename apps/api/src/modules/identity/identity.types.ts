import type { TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";
import type { ApiKeyScope, ApiKeyStatus } from "./schemas/api-key.schema.js";

/** Access token payload (TokenService.signAccessToken / verifyAccessToken). */
export interface AccessTokenPayload {
  sub: string;
  workspaceId: string | null;
  role: TenantRole | null;
  workspaceMemberStatus: WorkspaceMemberStatus | null;
  emailVerified: boolean;
  type: "access";
}

/** Refresh token payload — carries `jti` so it can be matched to a Session document. */
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

/**
 * Shape attached to `request.user` by JwtAuthGuard (SAD-001 Volume-2 §3,
 * Stage 1 — Identity Service Authentication). Consumed by
 * `@CurrentUser()` and `PermissionsGuard` (Stage 3, Capability Authorization).
 */
export interface AuthenticatedUser {
  userId: string;
  workspaceId: string | null;
  role: TenantRole | null;
  workspaceMemberStatus: WorkspaceMemberStatus | null;
  emailVerified: boolean;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Client-safe user projection — never includes passwordHash. */
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

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

/** PRD-006 Volume-2 §4.7 — read-only, immutable (BR-007). */
export interface LoginHistorySummary {
  id: string;
  success: boolean;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** PRD-006 Volume-3 §4.4 — never includes keyHash or the raw secret. */
export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scope: ApiKeyScope;
  status: ApiKeyStatus;
  createdBy: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
