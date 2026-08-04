import { IsEmail, IsIn } from "class-validator";
import { Transform } from "class-transformer";
import { TenantRole } from "@wapp/shared-types";

/** OWNER is deliberately excluded — ownership only changes via the explicit transfer-ownership flow, never an invite/role-change. */
export const INVITABLE_ROLES: readonly TenantRole[] = [
  TenantRole.ADMINISTRATOR,
  TenantRole.SALES_MANAGER,
  TenantRole.SALES_EXECUTIVE,
  TenantRole.MARKETING_EXECUTIVE,
  TenantRole.SUPPORT_MANAGER,
  TenantRole.SUPPORT_EXECUTIVE,
];

export class InviteTeamMemberDto {
  @IsEmail({}, { message: "Enter a valid email address" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsIn(INVITABLE_ROLES, { message: "Enter a valid workspace role" })
  role!: TenantRole;
}
