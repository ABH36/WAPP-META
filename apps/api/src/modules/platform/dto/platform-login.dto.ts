import { IsEmail, IsString, MinLength } from "class-validator";
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
}
