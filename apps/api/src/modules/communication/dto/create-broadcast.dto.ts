import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  templateId!: string;

  @IsString()
  phoneNumberId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetContactIds!: string[];

  // Applied identically to every recipient — no per-recipient
  // personalization in this slice (see docs/COMM-BROADCAST-LIFECYCLE.md).
  @IsArray()
  @IsString({ each: true })
  bodyParameters!: string[];

  // Omit for an immediate-send DRAFT (requires a separate POST .../send);
  // provide a future date to create it already SCHEDULED.
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;
}
