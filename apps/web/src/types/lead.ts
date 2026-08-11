import type { LeadSource, LeadStatus } from "@wapp/shared-types";

/**
 * FRD-001 Volume-5 §4.2 — mirrors `apps/api`'s `LeadSummary`
 * (`crm.types.ts`) field-for-field; the same shape for both list and
 * detail (no separate slimmer/richer response). `LeadStatus`/`LeadSource`
 * import cleanly from `@wapp/shared-types` — unlike Communication's
 * enums (TD-030), the CRM module imports these from the shared package
 * rather than defining local copies, so no drift exists here.
 */
export interface LeadSummary {
  id: string;
  contactId: string;
  customerId: string | null;
  leadName: string;
  mobileNumber: string;
  source: LeadSource;
  status: LeadStatus;
  company: string | null;
  email: string | null;
  industry: string | null;
  expectedValue: number | null;
  notes: string | null;
  assignedUserId: string | null;
  archivedAt: string | null;
  dealId: string | null;
  convertedAt: string | null;
  convertedBy: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `LeadConversionResult` — the response of `POST /crm/leads/:id/convert`. Customer and Deal are created together, atomically, in one backend transaction. */
export interface LeadConversionResult {
  leadId: string;
  customerId: string;
  dealId: string;
  convertedAt: string;
}
