import { IsArray, IsString } from "class-validator";

export class ReplyConversationTemplateDto {
  @IsString()
  templateId!: string;

  @IsArray()
  @IsString({ each: true })
  bodyParameters!: string[];
}
