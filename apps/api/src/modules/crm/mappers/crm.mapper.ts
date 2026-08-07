import type { CustomerDocument } from "../schemas/customer.schema.js";
import type { LeadDocument } from "../schemas/lead.schema.js";
import type { DealDocument } from "../schemas/deal.schema.js";
import type { ActivityDocument } from "../schemas/activity.schema.js";
import type { ActivitySummary, CustomerSummary, DealSummary, LeadSummary } from "../crm.types.js";

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
    dealId: lead.dealId ? lead.dealId.toString() : null,
    convertedAt: lead.convertedAt ? lead.convertedAt.toISOString() : null,
    convertedBy: lead.convertedBy,
    createdBy: lead.createdBy,
    updatedBy: lead.updatedBy,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

export function toDealSummary(deal: DealDocument): DealSummary {
  return {
    id: deal._id.toString(),
    workspaceId: deal.workspaceId,
    contactId: deal.contactId.toString(),
    customerId: deal.customerId.toString(),
    sourceLeadId: deal.sourceLeadId.toString(),
    title: deal.title,
    description: deal.description,
    value: deal.value,
    currency: deal.currency,
    probability: deal.probability,
    expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.toISOString() : null,
    assignedTo: deal.assignedTo,
    stage: deal.stage,
    wonAt: deal.wonAt ? deal.wonAt.toISOString() : null,
    lostAt: deal.lostAt ? deal.lostAt.toISOString() : null,
    lostReason: deal.lostReason,
    createdBy: deal.createdBy,
    updatedBy: deal.updatedBy,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
  };
}

export function toActivitySummary(activity: ActivityDocument): ActivitySummary {
  return {
    id: activity._id.toString(),
    workspaceId: activity.workspaceId,
    type: activity.type,
    customerId: activity.customerId ? activity.customerId.toString() : null,
    dealId: activity.dealId ? activity.dealId.toString() : null,
    title: activity.title,
    description: activity.description,
    text: activity.text,
    mentions: activity.mentions,
    dueDate: activity.dueDate ? activity.dueDate.toISOString() : null,
    priority: activity.priority,
    status: activity.status,
    assignedUserId: activity.assignedUserId,
    followUpDate: activity.followUpDate ? activity.followUpDate.toISOString() : null,
    followUpType: activity.followUpType,
    followUpCompletedAt: activity.followUpCompletedAt
      ? activity.followUpCompletedAt.toISOString()
      : null,
    reminderDate: activity.reminderDate ? activity.reminderDate.toISOString() : null,
    reminderType: activity.reminderType,
    archivedAt: activity.archivedAt ? activity.archivedAt.toISOString() : null,
    createdBy: activity.createdBy,
    updatedBy: activity.updatedBy,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}
