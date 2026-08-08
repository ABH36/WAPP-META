import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString } from "class-validator";

// §4.3's own examples — CRM/Inbox/Dashboard/Reports.
const LANDING_PAGES = ["CRM", "INBOX", "DASHBOARD", "REPORTS"] as const;

/** §4.3. `pinnedPages`/`favoriteModules` are free-form identifiers (not a fixed vocabulary per §4.3) — capped to a sane size to prevent unbounded growth. */
export class UpdateDashboardDto {
  @IsOptional()
  @IsIn(LANDING_PAGES)
  defaultLandingPage?: (typeof LANDING_PAGES)[number] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  pinnedPages?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  favoriteModules?: string[];
}
