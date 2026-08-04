import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

export class UpdateBusinessProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  // ADR-026 — optional. Must match packages/shared-validation's gstinSchema
  // regex exactly. Empty string clears a previously-set GSTIN.
  @IsOptional()
  @IsString()
  @Matches(/^(\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1})?$/, {
    message: "Enter a valid 15-character GSTIN",
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  gstin?: string;
}
