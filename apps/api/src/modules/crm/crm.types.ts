import type { CustomerSource, CustomerStatus, LeadSource, LeadStatus } from "@wapp/shared-types";

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
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
