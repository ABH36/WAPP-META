import { IsString, MinLength } from "class-validator";

export class VoidInvoiceDto {
  @IsString()
  @MinLength(1, { message: "A reason is required to void an invoice" })
  reason!: string;
}
