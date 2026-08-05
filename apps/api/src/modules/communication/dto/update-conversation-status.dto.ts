import { IsEnum } from "class-validator";
import { ConversationStatus } from "../schemas/conversation.schema.js";

export class UpdateConversationStatusDto {
  @IsEnum(ConversationStatus)
  status!: ConversationStatus;
}
