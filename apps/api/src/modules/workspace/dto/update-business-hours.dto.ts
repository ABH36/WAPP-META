import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class BusinessHoursDayDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsBoolean()
  isOpen!: boolean;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "openTime must be in HH:mm format" })
  openTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "closeTime must be in HH:mm format" })
  closeTime!: string;
}

export class PublicHolidayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be in YYYY-MM-DD format" })
  date!: string;

  @IsString()
  name!: string;
}

export class UpdateBusinessHoursDto {
  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursDayDto)
  schedule?: BusinessHoursDayDto[];

  // ADR-028 — manually configured, no holiday-calendar sync in Phase-1.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicHolidayDto)
  publicHolidays?: PublicHolidayDto[];
}
