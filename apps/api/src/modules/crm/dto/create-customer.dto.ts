import { IsEmail, IsOptional, IsString, Matches, MaxLength, ValidateIf } from "class-validator";

/**
 * PRD-004 Volume-1 §11/§19 — exactly one of mobileNumber/contactId must be
 * supplied: mobileNumber for Method 1 (Manual Creation — CustomerService
 * resolves/creates the Contact via ContactRepository.findOrCreate), contactId
 * for Method 3 (Convert Existing Contact). If both are supplied, the service
 * takes contactId (Method 3 wins) — see customer.service.ts.
 */
export class CreateCustomerDto {
  @IsString()
  @MaxLength(200)
  customerName!: string;

  // E.164 — same phoneNumberSchema format used for Contact/User mobile
  // numbers (packages/shared-validation), duplicated here per TD-001's
  // already-accepted class-validator/Zod split.
  @ValidateIf((dto: CreateCustomerDto) => !dto.contactId)
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Enter a valid phone number in international format, e.g. +919876543210",
  })
  mobileNumber?: string;

  @ValidateIf((dto: CreateCustomerDto) => !dto.mobileNumber)
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, {
    message: "Enter a valid 15-character GSTIN",
  })
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
