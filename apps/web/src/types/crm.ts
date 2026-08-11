/** FRD-001 Volume-3 §4.8 — mirrors `apps/api`'s `DashboardSummary` (`crm.types.ts`) field-for-field. The CRM Summary Card renders only a small subset (`totalCustomers`, `openDeals`, `pipelineValue`). */
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
