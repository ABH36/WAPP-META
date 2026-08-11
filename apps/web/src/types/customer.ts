import type { CustomerSource, CustomerStatus } from "@wapp/shared-types";

/** FRD-001 Volume-5 §4.3 — mirrors `apps/api`'s `CustomerSummary`. No `assignedUserId`/owner field exists on Customer at all — ownership only exists on Lead (`assignedUserId`) and Deal (`assignedTo`), confirmed against the real schema (Architecture Review, 2026-08-11). */
export interface CustomerSummary {
  id: string;
  contactId: string;
  customerName: string;
  mobileNumber: string;
  status: CustomerStatus;
  source: CustomerSource;
  companyName: string | null;
  email: string | null;
  gstNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  website: string | null;
  industry: string | null;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
