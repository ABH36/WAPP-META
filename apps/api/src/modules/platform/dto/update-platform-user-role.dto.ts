import { IsEnum } from "class-validator";
import { PlatformRole } from "@wapp/shared-types";

export class UpdatePlatformUserRoleDto {
  @IsEnum(PlatformRole)
  role!: PlatformRole;
}
