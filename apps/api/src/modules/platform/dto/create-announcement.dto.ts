import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { AnnouncementTargetType } from "../schemas/platform-announcement.schema.js";

/** §10 — message capped at 5000 characters. */
export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  @IsEnum(AnnouncementTargetType)
  targetType!: AnnouncementTargetType;

  @ValidateIf((dto: CreateAnnouncementDto) => dto.targetType === AnnouncementTargetType.PLANS)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  targetPlanIds?: string[];

  @ValidateIf((dto: CreateAnnouncementDto) => dto.targetType === AnnouncementTargetType.WORKSPACES)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  targetWorkspaceIds?: string[];
}
