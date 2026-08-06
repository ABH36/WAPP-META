import type { CustomerDocument } from "../schemas/customer.schema.js";
import type { LeadDocument } from "../schemas/lead.schema.js";
import type { CustomerSummary, LeadSummary } from "../crm.types.js";

export function toCustomerSummary(customer: CustomerDocument): CustomerSummary {
  return {
    id: customer._id.toString(),
    contactId: customer.contactId.toString(),
    customerName: customer.customerName,
    mobileNumber: customer.mobileNumber,
    status: customer.status,
    source: customer.source,
    companyName: customer.companyName,
    email: customer.email,
    gstNumber: customer.gstNumber,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    country: customer.country,
    postalCode: customer.postalCode,
    website: customer.website,
    industry: customer.industry,
    notes: customer.notes,
    createdBy: customer.createdBy,
    updatedBy: customer.updatedBy,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function toLeadSummary(lead: LeadDocument): LeadSummary {
  return {
    id: lead._id.toString(),
    contactId: lead.contactId.toString(),
    customerId: lead.customerId ? lead.customerId.toString() : null,
    leadName: lead.leadName,
    mobileNumber: lead.mobileNumber,
    source: lead.source,
    status: lead.status,
    company: lead.company,
    email: lead.email,
    industry: lead.industry,
    expectedValue: lead.expectedValue,
    notes: lead.notes,
    assignedUserId: lead.assignedUserId,
    archivedAt: lead.archivedAt ? lead.archivedAt.toISOString() : null,
    createdBy: lead.createdBy,
    updatedBy: lead.updatedBy,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}
