import { IsIn, IsOptional } from "class-validator";

// Same allowed set as Volume-1's workspace-level format preferences —
// these are overrides of that set, not a separate vocabulary.
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
const TIME_FORMATS = ["12h", "24h"] as const;

/**
 * §4.2 — nullable overrides of Workspace's own dateFormat/timeFormat
 * (Volume-1). Omit a field to leave it unchanged; send `null` explicitly to
 * clear the override (revert to inheriting the Workspace default) — see
 * docs/ADR-SET-003-personal-preference-resolution-strategy.md.
 */
export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(DATE_FORMATS)
  dateFormat?: (typeof DATE_FORMATS)[number] | null;

  @IsOptional()
  @IsIn(TIME_FORMATS)
  timeFormat?: (typeof TIME_FORMATS)[number] | null;
}
