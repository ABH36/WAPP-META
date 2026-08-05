import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateCampaignWaveDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  templateId!: string;

  // Applied identically to every recipient of this wave — same
  // no-per-recipient-personalization scoping as a standalone Broadcast.
  @IsArray()
  @IsString({ each: true })
  bodyParameters!: string[];

  // Required — a Campaign wave is inherently a scheduled point in a
  // timeline, not an immediate send (see docs/COMM-CAMPAIGN-LIFECYCLE.md).
  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;
}

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  phoneNumberId!: string;

  // Shared audience for every wave — one Campaign, one target list.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetContactIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCampaignWaveDto)
  waves!: CreateCampaignWaveDto[];
}
