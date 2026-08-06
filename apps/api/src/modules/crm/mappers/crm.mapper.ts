import type { CustomerDocument } from "../schemas/customer.schema.js";
import type { CustomerSummary } from "../crm.types.js";

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
