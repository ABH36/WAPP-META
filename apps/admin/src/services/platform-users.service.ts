import type { PlatformRole } from "@wapp/shared-types";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { PlatformUserProfile } from "../types/auth";

export interface CreatePlatformUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: PlatformRole;
}

/**
 * FRD-001 Volume-8 §4.3 — `MANAGE_PLATFORM_USERS`. No pagination on the
 * list route (plain array). "Reset Password" has zero backend support —
 * no route, no self-service, no admin-set flow exists anywhere in
 * `platform-users.controller.ts` (Architecture Review, 2026-08-12) — no
 * method is defined here for it, filed as Tech Debt.
 */
export const platformUsersService = {
  list(): Promise<PlatformUserProfile[]> {
    return apiGet("/platform/users");
  },

  create(payload: CreatePlatformUserPayload): Promise<PlatformUserProfile> {
    return apiPost("/platform/users", payload);
  },

  setActive(id: string, isActive: boolean): Promise<PlatformUserProfile> {
    return apiPatch(`/platform/users/${id}/active`, { isActive });
  },

  updateRole(id: string, role: PlatformRole): Promise<PlatformUserProfile> {
    return apiPatch(`/platform/users/${id}/role`, { role });
  },
};
