import { IsEmail, IsEnum, IsInt, IsString, Max, Min } from "class-validator";
import { EmailEncryption, EmailProvider } from "../schemas/email-integration.schema.js";

/** §4.2 — full replace, not a partial patch: every field is required since a partially-configured provider can't be Test-Connected meaningfully. */
export class UpdateEmailIntegrationDto {
  @IsEnum(EmailProvider)
  provider!: EmailProvider;

  @IsString()
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsString()
  username!: string;

  @IsString()
  credential!: string;

  @IsEnum(EmailEncryption)
  encryption!: EmailEncryption;

  @IsEmail()
  fromAddress!: string;
}
