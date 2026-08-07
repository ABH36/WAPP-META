import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";
import { ActivityType, FollowUpType, ReminderType, TaskPriority } from "@wapp/shared-types";

/**
 * PRD-004 Volume-5 §4/§5 — covers every ActivityType except NOTE, which has
 * its own dedicated CreateNoteDto/`POST /crm/notes` (§17, resolved
 * 2026-08-07: Notes need a different shape — text/mentions, not
 * title/dueDate/priority). type=NOTE is rejected in ActivityService, not
 * here.
 *
 * §5/BR-003 — customerId/dealId are each individually optional, but at
 * least one is required; enforced in ActivityService (not expressible as a
 * single class-validator rule across two independent optional fields).
 */
export class CreateActivityDto {
  @IsEnum(ActivityType)
  type!: ActivityType;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  dealId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // §6 — Task only.
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  // §11 — Task and Follow-up only.
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  // §7 — Follow-up only.
  @ValidateIf((dto: CreateActivityDto) => dto.type === ActivityType.FOLLOW_UP)
  @IsDateString()
  followUpDate?: string;

  @ValidateIf((dto: CreateActivityDto) => dto.type === ActivityType.FOLLOW_UP)
  @IsEnum(FollowUpType)
  followUpType?: FollowUpType;

  // §9 — Reminder only.
  @ValidateIf((dto: CreateActivityDto) => dto.type === ActivityType.REMINDER)
  @IsDateString()
  reminderDate?: string;

  @ValidateIf((dto: CreateActivityDto) => dto.type === ActivityType.REMINDER)
  @IsEnum(ReminderType)
  reminderType?: ReminderType;
}
