import { IsArray, IsString, Matches } from "class-validator";

export class SendTemplateMessageDto {
  // E.164 — matches packages/shared-validation's phoneNumberSchema.
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Enter a valid phone number in international format, e.g. +919876543210",
  })
  to!: string;

  @IsString()
  templateId!: string;

  // Substituted in order into the BODY component's {{1}}, {{2}}, ... placeholders.
  // Header/button parameters aren't supported by this slice — see
  // docs/COMM-TEMPLATE-LIFECYCLE.md.
  @IsArray()
  @IsString({ each: true })
  bodyParameters!: string[];
}
