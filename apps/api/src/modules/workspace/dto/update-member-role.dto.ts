import { IsIn } from "class-validator";
import { TenantRole } from "@wapp/shared-types";
import { INVITABLE_ROLES } from "./invite-team-member.dto.js";

export class UpdateMemberRoleDto {
  // OWNER excluded — see invite-team-member.dto.ts. Role changes to/from
  // OWNER only ever happen via the explicit transfer-ownership endpoint.
  @IsIn(INVITABLE_ROLES, { message: "Enter a valid workspace role" })
  role!: TenantRole;
}
