import { IsBoolean, IsIn, IsNumber, IsOptional, IsPositive, IsString } from "class-validator";
import type { RecordPaymentOutcome } from "../../billing/services/payment.service.js";

/** §4.3/§9 — POST /platform/payments/manual. §4.3's "Mark Payment Verified"/"Attach Payment Evidence" are folded into recording itself (Architecture Review, 2026-08-08) rather than separate actions. */
export class RecordPlatformPaymentDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  invoiceId!: string;

  @IsString()
  gateway!: string;

  @IsString()
  gatewayReference!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  currency!: string;

  @IsIn(["PAID", "FAILED"])
  outcome!: RecordPaymentOutcome;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}
