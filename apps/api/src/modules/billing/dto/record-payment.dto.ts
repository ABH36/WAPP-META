import { IsIn, IsNumber, IsPositive, IsString } from "class-validator";
import type { RecordPaymentOutcome } from "../services/payment.service.js";

export class RecordPaymentDto {
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

  // No real Payment Gateway callback exists yet (§14 Out of Scope) — the
  // recorder reports the outcome they observed (e.g. checked a bank
  // statement), not a status the platform independently verified.
  @IsIn(["PAID", "FAILED"])
  outcome!: RecordPaymentOutcome;
}
