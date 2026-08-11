import type { CustomerSource, CustomerStatus } from "@wapp/shared-types";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { Paginated } from "../types/pagination";
import type { CustomerSummary } from "../types/customer";

export interface CreateCustomerPayload {
  customerName: string;
  mobileNumber?: string;
  contactId?: string;
  companyName?: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  industry?: string;
  notes?: string;
}

export type UpdateCustomerPayload = Partial<
  Omit<CreateCustomerPayload, "mobileNumber" | "contactId">
> & { customerName?: string };

interface ListCustomersParams {
  status?: CustomerStatus;
  source?: CustomerSource;
  sortBy?: "customerName" | "createdAt" | "updatedAt" | "companyName";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/** FRD-001 Volume-5 §4.3 — Archive is Customer's real, terminal soft-delete (ADR-CRM-004) — no hard delete route exists. `block`/`activate`/`archive` are each a distinct action route, not a generic status PATCH. */
export const customerService = {
  create(payload: CreateCustomerPayload): Promise<CustomerSummary> {
    return apiPost("/crm/customers", payload);
  },

  list(params: ListCustomersParams): Promise<Paginated<CustomerSummary>> {
    return apiGet("/crm/customers", params as Record<string, unknown>);
  },

  search(q: string, page?: number, limit?: number): Promise<Paginated<CustomerSummary>> {
    return apiGet("/crm/customers/search", { q, page, limit });
  },

  getById(id: string): Promise<CustomerSummary> {
    return apiGet(`/crm/customers/${id}`);
  },

  update(id: string, payload: UpdateCustomerPayload): Promise<CustomerSummary> {
    return apiPatch(`/crm/customers/${id}`, payload);
  },

  block(id: string): Promise<CustomerSummary> {
    return apiPatch(`/crm/customers/${id}/block`);
  },

  activate(id: string): Promise<CustomerSummary> {
    return apiPatch(`/crm/customers/${id}/activate`);
  },

  archive(id: string): Promise<CustomerSummary> {
    return apiPatch(`/crm/customers/${id}/archive`);
  },
};
