import type { TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";

/** FRD-001 Volume-4 §4.2/§4.3 — mirrors `apps/api`'s `MemberSummary` (`workspace.types.ts`). Consumed only to populate the Assign-to picker in the Inbox/Conversation View — no Team Management UI (invite/remove/role-change) is built this volume, that stays out of scope per FRD-001 Volume-3. */
export interface MemberSummary {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: TenantRole;
  workspaceMemberStatus: WorkspaceMemberStatus;
  createdAt: string;
}
