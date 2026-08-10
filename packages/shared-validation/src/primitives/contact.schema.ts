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

/**
 * FRD-001 Volume-2 — mirrors the identical `class-validator` rule set
 * duplicated across `apps/api/src/modules/identity/dto/register.dto.ts`,
 * `reset-password.dto.ts`, and `apps/api/src/modules/settings/dto/change-password.dto.ts`
 * exactly (min 8 / max 128, one uppercase, one lowercase, one digit — no
 * special-character requirement in any backend DTO). No backend change —
 * this is the frontend catching up to what the backend already enforces,
 * partially closing TD-001. `PASSWORD_POLICY_RULES` exists so a Password
 * Strength Indicator can check/display each rule individually rather than
 * re-deriving them from the regex/schema internals.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export interface PasswordPolicyRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_POLICY_RULES: PasswordPolicyRule[] = [
  { id: "minLength", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "maxLength", label: "At most 128 characters", test: (p) => p.length <= 128 },
  { id: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "One number", test: (p) => /[0-9]/.test(p) },
];
