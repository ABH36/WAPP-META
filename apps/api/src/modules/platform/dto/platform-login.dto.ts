import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class PlatformLoginDto {
  @IsEmail({}, { message: "Enter a valid email address" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MinLength(1, { message: "Password is required" })
  password!: string;

  // PHD-001 Volume-1 (Security Hardening) — see the tenant LoginDto's
  // identical field for the full rationale.
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
