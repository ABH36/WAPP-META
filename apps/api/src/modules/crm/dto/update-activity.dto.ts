import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { FollowUpType, ReminderType, TaskPriority } from "@wapp/shared-types";

/**
 * PRD-004 Volume-5 — type/customerId/dealId are deliberately absent here:
 * type is immutable (BR-002), and identity references are permanent (§19).
 * status and assignedUserId go through their own dedicated endpoints
 * (/status, /assign). Every field here is optional and only meaningful for
 * its owning ActivityType — ActivityService doesn't reject an irrelevant
 * field being sent, it just won't have been set on creation for that type.
 */
export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsEnum(FollowUpType)
  followUpType?: FollowUpType;

  @IsOptional()
  @IsDateString()
  reminderDate?: string;

  @IsOptional()
  @IsEnum(ReminderType)
  reminderType?: ReminderType;
}
