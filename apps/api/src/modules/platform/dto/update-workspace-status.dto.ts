import { IsIn, IsString, MaxLength, MinLength, ValidateIf } from "class-validator";
import { WorkspaceStatus } from "@wapp/shared-types";

/**
 * §9 — single `PATCH /platform/workspaces/:id/status` endpoint covering
 * Suspend/Reactivate/Archive (§4.1). Restricted to these three targets
 * deliberately — TRIAL/ACTIVE(from-trial)/EXPIRED/CANCELLED are all
 * billing-lifecycle-driven transitions (ADR-BILL-002), never a platform
 * admin's direct write. §10: a reason is required for Suspend and Archive,
 * not accepted for Reactivate.
 */
const PLATFORM_ASSIGNABLE_STATUSES = [
  WorkspaceStatus.SUSPENDED,
  WorkspaceStatus.ACTIVE,
  WorkspaceStatus.ARCHIVED,
] as const;

export class UpdateWorkspaceStatusDto {
  @IsIn(PLATFORM_ASSIGNABLE_STATUSES, {
    message: "status must be one of SUSPENDED, ACTIVE, or ARCHIVED",
  })
  status!: WorkspaceStatus;

  @ValidateIf((dto: UpdateWorkspaceStatusDto) => dto.status !== WorkspaceStatus.ACTIVE)
  @IsString()
  @MinLength(1, { message: "A reason is required for this status change" })
  @MaxLength(1000)
  reason?: string;
}
