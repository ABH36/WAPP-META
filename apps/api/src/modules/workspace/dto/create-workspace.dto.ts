import { IsString, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2, { message: "Workspace name must be at least 2 characters" })
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  name!: string;
}
