import { IsInt, IsString, Max, Min, MinLength } from "class-validator";
import { SUPPORT_SESSION_MAX_DURATION_MINUTES } from "../schemas/support-session.schema.js";

/** §4.1/§10 — BR-001: reason required; duration capped at 4 hours. */
export class RequestSupportAccessDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @MinLength(10, { message: "A meaningful reason is required to request Break-Glass access" })
  reason!: string;

  @IsInt()
  @Min(1)
  @Max(SUPPORT_SESSION_MAX_DURATION_MINUTES)
  durationMinutes!: number;
}
