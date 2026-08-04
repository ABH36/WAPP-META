import { z } from "zod";

/**
 * E.164-style phone number. Used for Customer/Lead mobile numbers (the primary
 * dedup identifier — PRD-000C ADR-007/BDC-013) and user mobile numbers (PRD-002
 * REG-BR-003). Defined once here so the frontend form and the backend DTO can
 * never validate this differently.
 */
export const phoneNumberSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Enter a valid phone number in international format, e.g. +919876543210",
  );

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");

/**
 * Indian GSTIN format. Traces to ADR-026 (GST/Non-GST invoice logic) — GST Number
 * is optional at the Workspace level, but when provided it must be well-formed.
 */
export const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
    "Enter a valid 15-character GSTIN",
  )
  .optional()
  .or(z.literal(""));

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");
