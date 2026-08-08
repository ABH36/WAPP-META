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

/** §10 — HTTPS only. */
export class CreateWebhookDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  url!: string;

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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(WebhookEventType, { each: true })
  events!: WebhookEventType[];
}
