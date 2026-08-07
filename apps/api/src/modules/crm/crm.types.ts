import type {
  ActivityType,
  CustomerSource,
  CustomerStatus,
  DealLostReason,
  DealStage,
  FollowUpType,
  LeadSource,
  LeadStatus,
  ReminderType,
  TaskPriority,
  TaskStatus,
} from "@wapp/shared-types";

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

export interface DealSummary {
  id: string;
  workspaceId: string;
  contactId: string;
  customerId: string;
  sourceLeadId: string;
  title: string;
  description: string | null;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate: string | null;
  assignedTo: string | null;
  stage: DealStage;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: DealLostReason | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivitySummary {
  id: string;
  workspaceId: string;
  type: ActivityType;
  customerId: string | null;
  dealId: string | null;
  title: string | null;
  description: string | null;
  text: string | null;
  mentions: string[];
  dueDate: string | null;
  priority: TaskPriority | null;
  status: TaskStatus | null;
  assignedUserId: string | null;
  followUpDate: string | null;
  followUpType: FollowUpType | null;
  followUpCompletedAt: string | null;
  reminderDate: string | null;
  reminderType: ReminderType | null;
  archivedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadConversionResult {
  leadId: string;
  customerId: string;
  dealId: string;
  convertedAt: string;
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
  dealId: string | null;
  convertedAt: string | null;
  convertedBy: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
