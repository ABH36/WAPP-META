import type { CustomerSource, CustomerStatus } from "@wapp/shared-types";

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
