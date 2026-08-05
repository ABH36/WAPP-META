import { IsString, MinLength } from "class-validator";

/**
 * Payload the frontend sends after a successful Meta Embedded Signup —
 * `code` from the Facebook Login for Business callback, `wabaId`/
 * `phoneNumberId` from the `postMessage` events Meta's signup flow emits
 * during the same session (documented Embedded Signup pattern).
 */
export class ConnectWhatsAppDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  wabaId!: string;

  @IsString()
  @MinLength(1)
  phoneNumberId!: string;
}
