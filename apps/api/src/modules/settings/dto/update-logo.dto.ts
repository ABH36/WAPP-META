import { IsString, IsUrl } from "class-validator";

/** Called after the client has already uploaded directly to Cloudinary using a signature from GET /settings/branding/logo/upload-signature — SEC-016, no file bytes ever pass through this API. */
export class UpdateLogoDto {
  @IsUrl()
  logoUrl!: string;

  @IsString()
  logoPublicId!: string;
}
