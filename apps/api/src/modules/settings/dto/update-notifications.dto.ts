import { IsBoolean, IsObject, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

/** §9 — "Notification booleans only." */
export class NotificationChannelDto {
  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;
}

/** §4.4 — the 7 personal, per-event notification preferences. Each event is optional; only the ones actually sent are updated. */
export class UpdateNotificationsEventsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  newAssignment?: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  newLead?: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  dealWon?: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  mention?: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  taskReminder?: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  followUpReminder?: NotificationChannelDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationChannelDto)
  billingReminder?: NotificationChannelDto;
}

export class UpdateNotificationsDto {
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateNotificationsEventsDto)
  notifications!: UpdateNotificationsEventsDto;
}
