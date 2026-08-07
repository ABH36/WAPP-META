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

export interface ReportsQueryOptions {
  dateFrom?: string;
  dateTo?: string;
  assignedUserId?: string;
  customerId?: string;
  dealStage?: DealStage;
  leadStatus?: LeadStatus;
  leadSource?: LeadSource;
}

/** PRD-004 Volume-6 §4 — every count/value is a live query against current state (BR-006), nothing persisted (BR-004). */
export interface DashboardSummary {
  totalCustomers: number;
  activeCustomers: number;
  totalLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  lostLeads: number;
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  pipelineValue: number;
  forecastValue: number;
  overdueTasks: number;
  /** §4, 7-day look-ahead window (resolved 2026-08-07, Architecture Review). */
  upcomingFollowUps: number;
}

export interface DistributionEntry {
  key: string;
  count: number;
}

/** §5. Rates are 0-100. Average Qualification Time is an approximation (see docs/ADR-CRM-019-crm-reporting-strategy.md) — Lead has no per-status-transition timestamp, so it's derived from createdAt→updatedAt for Leads at or past QUALIFIED. */
export interface LeadReport {
  totalLeads: number;
  leadSourceDistribution: DistributionEntry[];
  leadStatusDistribution: DistributionEntry[];
  conversionRate: number;
  qualificationRate: number;
  lostRate: number;
  averageQualificationTimeHours: number | null;
}

export interface StageValueEntry {
  stage: DealStage;
  count: number;
  value: number;
}

/** §6. Average Sales Cycle is precise (Deal.wonAt - Deal.createdAt over WON deals). */
export interface DealReport {
  totalDeals: number;
  dealStageDistribution: StageValueEntry[];
  wonCount: number;
  lostCount: number;
  revenueByStage: StageValueEntry[];
  forecastRevenue: number;
  averageDealValue: number;
  averageSalesCycleHours: number | null;
}

/** §7. Follow-ups Due = incomplete Follow-ups whose followUpDate has arrived (due now or overdue) — a distinct metric from the Dashboard's forward-looking "Upcoming Follow-ups". */
export interface ActivityReport {
  activitiesByType: DistributionEntry[];
  tasksPending: number;
  tasksCompleted: number;
  followUpsDue: number;
  notesCreated: number;
  callsLogged: number;
  meetingsLogged: number;
}

/** §8. Average Response Time is dropped entirely (resolved 2026-08-07 — depends on Communication data Volume-6 never establishes as a dependency). */
export interface TeamPerformanceEntry {
  userId: string;
  dealsWon: number;
  leadsQualified: number;
  tasksCompleted: number;
  followUpsCompleted: number;
  averageDealCycleHours: number | null;
}

export interface TeamPerformanceReport {
  entries: TeamPerformanceEntry[];
}

export interface ForecastBucket {
  period: string;
  value: number;
}

/** §9. Deal data only, calculated dynamically, never persisted (BR-004). Quarterly/Yearly use standard calendar quarters (resolved 2026-08-07 — no fiscal-year concept exists in Workspace settings). */
export interface ForecastReport {
  pipelineForecast: number;
  monthlyForecast: ForecastBucket[];
  quarterlyForecast: ForecastBucket[];
  yearlyForecast: ForecastBucket[];
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
