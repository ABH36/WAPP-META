import { IsEmail, IsEnum, IsString, MaxLength, MinLength, Matches } from "class-validator";
import { Transform } from "class-transformer";
import { PlatformRole } from "@wapp/shared-types";

export class CreatePlatformUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsEmail({}, { message: "Enter a valid email address" })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  @Matches(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one number" })
  password!: string;

  @IsEnum(PlatformRole)
  role!: PlatformRole;
}
