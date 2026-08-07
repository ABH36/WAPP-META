import { IsIn, IsOptional, IsString, Length } from "class-validator";

// §6 defers the exact allowed set to a future Business Rules pass — these
// are the common conventions already implied by the India-first market
// (D002), the same "reasonable default, not an invented business value"
// treatment already given to businessHours.timezone's own default.
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
const TIME_FORMATS = ["12h", "24h"] as const;

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsIn(DATE_FORMATS)
  dateFormat?: (typeof DATE_FORMATS)[number];

  @IsOptional()
  @IsIn(TIME_FORMATS)
  timeFormat?: (typeof TIME_FORMATS)[number];
}
