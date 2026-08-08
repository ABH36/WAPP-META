import { IsString, Matches, MaxLength, MinLength } from "class-validator";

/** §4.5 — same password-strength rule already enforced at registration/reset (RegisterDto/ResetPasswordDto). */
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one number" })
  newPassword!: string;
}
