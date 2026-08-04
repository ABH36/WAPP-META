import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@wapp/shared-types";

export const REQUIRED_PERMISSION_KEY = "requiredPermission";

/**
 * Coarse-grained (Capability) authorization — SAD-001 Volume-2 §6, Stage 3.
 * Business modules apply this to a route to declare "a user needs at least
 * VIEW_ONLY-level access to this Permission to call this endpoint at all."
 * Resource-level (Stage 4, e.g. "only *your own* leads") authorization stays
 * the business module's own responsibility inside the handler — this guard
 * only answers the role-level question, using the single canonical
 * `PERMISSION_MATRIX` from `@wapp/shared-types`.
 */
export const RequirePermission = (permission: Permission): ReturnType<typeof SetMetadata> =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
