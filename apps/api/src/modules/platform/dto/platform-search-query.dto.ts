import { IsString, MinLength } from "class-validator";

/** §4.6 — Workspace Search, limited to Workspace + User this volume (per resolved Question 3). */
export class PlatformSearchQueryDto {
  @IsString()
  @MinLength(1)
  q!: string;
}
