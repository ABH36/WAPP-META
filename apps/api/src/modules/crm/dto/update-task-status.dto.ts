import { IsEnum } from "class-validator";
import { TaskStatus } from "@wapp/shared-types";

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;
}
