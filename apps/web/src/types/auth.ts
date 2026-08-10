import type { TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";

/**
 * FRD-001 Volume-1 §9 — mirrors `apps/api/src/modules/identity/identity.types.ts`'s
 * `UserProfile`/`IssuedTokenPair` exactly. Not itself importable from
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

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
