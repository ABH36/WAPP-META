import { IsString, MinLength } from "class-validator";

/** §4.3/§10 — Refund Recording requires a reason. */
export class RefundPlatformPaymentDto {
  @IsString()
  @MinLength(1, { message: "A reason is required to record a refund" })
  reason!: string;
}
