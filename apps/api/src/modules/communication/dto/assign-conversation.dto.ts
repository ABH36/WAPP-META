import { IsString, ValidateIf } from "class-validator";

export class AssignConversationDto {
  // Explicit null unassigns; omitted/undefined fails validation (the caller
  // must state intent either way). `ValidateIf` skips @IsString only when
  // the value is exactly null — undefined still falls through to @IsString
  // and fails, so the property can't just be left out.
  @ValidateIf((dto: AssignConversationDto) => dto.assignedToUserId !== null)
  @IsString()
  assignedToUserId!: string | null;
}
