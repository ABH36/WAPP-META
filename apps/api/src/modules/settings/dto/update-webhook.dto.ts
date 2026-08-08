import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUrl,
  Max,
  Min,
} from "class-validator";
import { WebhookEventType } from "@wapp/shared-types";
import {
  WEBHOOK_MAX_RETRY_COUNT,
  WEBHOOK_MAX_TIMEOUT_SECONDS,
  WEBHOOK_MIN_RETRY_COUNT,
  WEBHOOK_MIN_TIMEOUT_SECONDS,
} from "../schemas/webhook-config.schema.js";

/** The secret is never updatable through this endpoint — no rotate-secret action exists in §4.3, unlike API Keys' explicit Rotate. */
export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(WEBHOOK_MIN_RETRY_COUNT)
  @Max(WEBHOOK_MAX_RETRY_COUNT)
  retryCount?: number;

  @IsOptional()
  @IsInt()
  @Min(WEBHOOK_MIN_TIMEOUT_SECONDS)
  @Max(WEBHOOK_MAX_TIMEOUT_SECONDS)
  timeoutSeconds?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(WebhookEventType, { each: true })
  events?: WebhookEventType[];
}
