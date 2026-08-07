import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * PRD-004 Volume-5 §8 — a specialized creation shape distinct from
 * CreateActivityDto (no title/dueDate/priority; `text`/`mentions` instead).
 * The resulting document is a regular Activity (type=NOTE), fully
 * manageable afterward via the generic /crm/activities/:id routes — see
 * docs/ADR-CRM-015-activity-timeline-strategy.md. Attachments are Out of
 * Scope (§20), so no field exists for them.
 */
export class CreateNoteDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsString()
  @MaxLength(5000)
  text!: string;

  // §8 — mentioned platform User ids, unvalidated against workspace
  // membership (no business rule requires it).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];
}
