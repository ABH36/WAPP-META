import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class SendMessageDto {
  // E.164 — matches packages/shared-validation's phoneNumberSchema.
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Enter a valid phone number in international format, e.g. +919876543210",
  })
  to!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text!: string;
}
