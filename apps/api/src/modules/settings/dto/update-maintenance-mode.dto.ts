import { IsBoolean } from "class-validator";

/** §10 — boolean only. */
export class UpdateMaintenanceModeDto {
  @IsBoolean()
  enabled!: boolean;
}
