import { IsDateString, IsEnum, IsOptional, IsString, Length } from "class-validator";
import { ApiKeyScope } from "../../identity/schemas/api-key.schema.js";

export class CreateApiKeyDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsEnum(ApiKeyScope)
  scope?: ApiKeyScope;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
