/**
 * Traces to: SAD-002 §5 (Mandatory Fields), TAD-001 v1.2 PATCH-001.
 *
 * Every tenant-owned business entity extends this. `workspaceId` is the primary
 * tenant-isolation field — no tenant-owned collection may omit it (SEC-004 / SAD-002
 * §6). Platform-level collections (see PlatformEntity below) are the only exemption.
 */
export interface TenantOwnedEntity {
  _id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
}

/**
 * Platform-level collections (Platform Administration domain — e.g. platform_users,
 * global_audit) are explicitly exempt from workspaceId per SAD-002 §5.
 */
export interface PlatformEntity {
  _id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
}
