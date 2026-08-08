import { IsInt, IsOptional, Max, Min } from "class-validator";
import { RETENTION_MAX_DAYS, RETENTION_MIN_DAYS } from "../schemas/retention-policy.schema.js";

/** §10 — 30-3650 days. */
export class UpdateRetentionPolicyDto {
  @IsOptional()
  @IsInt()
  @Min(RETENTION_MIN_DAYS)
  @Max(RETENTION_MAX_DAYS)
  auditLogRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(RETENTION_MIN_DAYS)
  @Max(RETENTION_MAX_DAYS)
  loginHistoryRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(RETENTION_MIN_DAYS)
  @Max(RETENTION_MAX_DAYS)
  notificationHistoryRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(RETENTION_MIN_DAYS)
  @Max(RETENTION_MAX_DAYS)
  webhookDeliveryLogRetentionDays?: number;
}
