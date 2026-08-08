import { IsEnum, IsOptional } from "class-validator";
import { SidebarState, Theme, UiDensity } from "@wapp/shared-types";

/** §4.1/§9. */
export class UpdateThemeDto {
  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @IsOptional()
  @IsEnum(SidebarState)
  sidebar?: SidebarState;

  @IsOptional()
  @IsEnum(UiDensity)
  density?: UiDensity;
}
