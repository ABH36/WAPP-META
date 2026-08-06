import { IsEnum } from "class-validator";
import { LeadStatus } from "@wapp/shared-types";

export class UpdateLeadStatusDto {
  @IsEnum(LeadStatus)
  status!: LeadStatus;
}
