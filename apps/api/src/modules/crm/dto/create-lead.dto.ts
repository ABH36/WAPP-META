import {
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { LeadSource } from "@wapp/shared-types";

/**
 * PRD-004 Volume-2 §5/§9/§11 — exactly one of mobileNumber/contactId/
 * customerId identifies the Lead: mobileNumber for Method 1 (Manual Entry
 * — LeadService resolves/creates the Contact via ContactRepository.
 * findOrCreate), contactId for Method 2 (WhatsApp Conversation), customerId
 * for Method 3 (Existing Customer Upsell Opportunity — the Customer's own
 * Contact is used, and Lead.customerId is set directly). If more than one
 * is supplied, customerId wins over contactId, which wins over
 * mobileNumber — see lead.service.ts.
 *
 * Unlike Customer, source is not derived from which field was supplied —
 * see LeadSource's own doc comment for why.
 */
export class CreateLeadDto {
  @IsString()
  @MaxLength(200)
  leadName!: string;

  @ValidateIf((dto: CreateLeadDto) => !dto.contactId && !dto.customerId)
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: "Enter a valid phone number in international format, e.g. +919876543210",
  })
  mobileNumber?: string;

  @ValidateIf((dto: CreateLeadDto) => !dto.mobileNumber && !dto.customerId)
  @IsString()
  contactId?: string;

  @ValidateIf((dto: CreateLeadDto) => !dto.mobileNumber && !dto.contactId)
  @IsString()
  customerId?: string;

  @IsEnum(LeadSource)
  source!: LeadSource;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expectedValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
