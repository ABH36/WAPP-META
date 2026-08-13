import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class LoginDto {
  @IsEmail({}, { message: "Enter a valid email address" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MinLength(1, { message: "Password is required" })
  password!: string;

  // PHD-001 Volume-1 (Security Hardening) — drives the refresh-token
  // cookie's persistence (Max-Age set vs omitted/session-only), now that
  // the backend, not the frontend, owns the cookie. Optional; omitted =
  // session-only cookie.
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
