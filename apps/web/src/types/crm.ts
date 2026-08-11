import type { DealStage, LeadSource, LeadStatus } from "@wapp/shared-types";

/** FRD-001 Volume-3 §4.8 — mirrors `apps/api`'s `DashboardSummary` (`crm.types.ts`) field-for-field. The CRM Summary Card renders only a small subset (`totalCustomers`, `openDeals`, `pipelineValue`). FRD-001 Volume-5 uses the full shape for the real CRM Dashboard. */
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
  upcomingFollowUps: number;
}

/** FRD-001 Volume-5 §4.10/§9 — shared query filters every report/export endpoint accepts (each ignores filters irrelevant to its own entity). */
export interface ReportsQueryOptions {
  dateFrom?: string;
  dateTo?: string;
  assignedUserId?: string;
  customerId?: string;
  dealStage?: DealStage;
  leadStatus?: LeadStatus;
  leadSource?: LeadSource;
}

export interface DistributionEntry {
  key: string;
  count: number;
}

/** FRD-001 Volume-5 §4.10 — mirrors `LeadReport`. `averageQualificationTimeHours` is an approximation (createdAt→updatedAt for Leads at or past QUALIFIED — Lead has no per-status-transition timestamp). */
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

/** FRD-001 Volume-5 §4.10 — mirrors `DealReport`. `averageSalesCycleHours` is precise (`Deal.wonAt - Deal.createdAt` over WON deals). */
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

/** FRD-001 Volume-5 §4.10 — mirrors `ActivityReport`. `followUpsDue` = incomplete Follow-ups whose `followUpDate` has arrived (due now or overdue) — distinct from the Dashboard's forward-looking `upcomingFollowUps`. */
export interface ActivityReport {
  activitiesByType: DistributionEntry[];
  tasksPending: number;
  tasksCompleted: number;
  followUpsDue: number;
  notesCreated: number;
  callsLogged: number;
  meetingsLogged: number;
}

/** Mirrors `TeamPerformanceEntry`/`TeamPerformanceReport` — not one of the FRD's named report screens, but exposed by the backend; used only if a future volume surfaces it. */
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

/** FRD-001 Volume-5 §4.11 — mirrors `ForecastReport`. `pipelineForecast` is probability-weighted (`value × probability/100`), distinct from `DashboardSummary.pipelineValue` (raw, unweighted) — the two must never be labeled identically in the UI. No "probability breakdown" field exists anywhere (Architecture Review, 2026-08-11). */
export interface ForecastReport {
  pipelineForecast: number;
  monthlyForecast: ForecastBucket[];
  quarterlyForecast: ForecastBucket[];
  yearlyForecast: ForecastBucket[];
}

/** Mirrors the real `ExportReportType`/`ExportFormat` enums (`export-report.dto.ts`) — lowercase string values, unlike most other backend enums in this codebase. */
export type ExportReportType =
  "dashboard" | "leads" | "deals" | "activities" | "team-performance" | "forecast";
export type ExportFormat = "csv" | "excel";
