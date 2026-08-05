import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { TemplateCategory } from "../schemas/template.schema.js";

export class TemplateComponentDto {
  @IsIn(["HEADER", "BODY", "FOOTER", "BUTTONS"])
  type!: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";

  @IsOptional()
  @IsIn(["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"])
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  text?: string;

  // Meta's button shape varies by button type (QUICK_REPLY/URL/PHONE_NUMBER)
  // — validated by Meta's own submission review, not re-modeled here (same
  // reasoning as TemplateComponent's own doc comment).
  @IsOptional()
  @IsArray()
  buttons?: Array<Record<string, unknown>>;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  name!: string;

  @IsEnum(TemplateCategory)
  category!: TemplateCategory;

  @IsString()
  @MinLength(2)
  @MaxLength(35)
  language!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TemplateComponentDto)
  components!: TemplateComponentDto[];
}
