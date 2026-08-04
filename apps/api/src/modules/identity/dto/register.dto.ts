import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

/**
 * Field rules must stay in sync with
 * packages/shared-validation/src/primitives/contact.schema.ts (the frontend's
 * Zod source of truth) — duplicated here as class-validator decorators
 * because the API DTO layer uses class-validator, not Zod. Traces to
 * PRD-002 v1.1 REG-BR-001–003.
 */
export class RegisterDto {
  @IsString()
  @MinLength(2, { message: "Full name must be at least 2 characters" })
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  fullName!: string;

  @IsEmail({}, { message: "Enter a valid email address" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  // E.164 — must match packages/shared-validation's phoneNumberSchema exactly.
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Enter a valid phone number in international format, e.g. +919876543210",
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  mobileNumber!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one number" })
  password!: string;
}
