import type {
  BillingCycle,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionStatus,
  WorkspaceStatus,
} from "@wapp/shared-types";

/**
 * FRD-001 Volume-8 — mirrors `apps/api/src/modules/platform/platform.types.ts`
 * and the local enums declared in that module's own schema files (none of
 * which exist in `@wapp/shared-types` — confirmed by grep, same discipline
 * every prior volume applied to genuinely backend-local types).
 * `WorkspaceStatus`/`SubscriptionStatus`/`InvoiceStatus`/`PaymentStatus`/
 * `BillingCycle` DO exist in `@wapp/shared-types` and are imported
 * directly — Billing's own Volume-6 types already established these are
 * safe to import (no drift), and Platform's billing-operations DTOs reuse
 * the exact same tenant Billing schemas, just through platform-scoped
 * routes.
 */

export enum SupportTicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  WAITING_CUSTOMER = "WAITING_CUSTOMER",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum SupportTicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum SupportTicketCategory {
  BILLING = "BILLING",
  TECHNICAL = "TECHNICAL",
  ACCOUNT = "ACCOUNT",
  FEATURE_REQUEST = "FEATURE_REQUEST",
  OTHER = "OTHER",
}

export enum SupportSessionStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  TERMINATED = "TERMINATED",
}

export enum GovernancePolicyKey {
  PASSWORD_POLICY = "PASSWORD_POLICY",
  SESSION_TIMEOUT = "SESSION_TIMEOUT",
  PLATFORM_MAINTENANCE_DEFAULTS = "PLATFORM_MAINTENANCE_DEFAULTS",
  PLATFORM_LOGIN_POLICY = "PLATFORM_LOGIN_POLICY",
  PLATFORM_LIMITS = "PLATFORM_LIMITS",
  DEFAULT_RETENTION = "DEFAULT_RETENTION",
}

export enum AnnouncementTargetType {
  ALL = "ALL",
  PLANS = "PLANS",
  WORKSPACES = "WORKSPACES",
}

export enum FeatureFlagKey {
  CRM_MODULE = "CRM_MODULE",
  BILLING_MODULE = "BILLING_MODULE",
  COMMUNICATION_MODULE = "COMMUNICATION_MODULE",
  AI_ASSISTANT = "AI_ASSISTANT",
  BETA_FEATURES = "BETA_FEATURES",
}

/** §4.1 — mirrors `apps/api`'s `PlatformDashboardSnapshot`. Narrower than the FRD's own field list: no "active subscriptions"/"revenue summary" breakdown here (those live on `PlatformBillingDashboardSnapshot`) and no platform-wide "recent activity" exists anywhere (Architecture Review, 2026-08-12). `systemHealth` is the shared `HealthChecks` shape (`apps/api/src/health/health-check.service.ts`) — 5 flat booleans, not the `{checks: [...]}` array shape Settings' Diagnostics screen uses (a different, unrelated type despite the similar name). */
export interface PlatformDashboardSnapshot {
  workspaces: { total: number; byStatus: Record<WorkspaceStatus, number> };
  totalUsers: number;
  totalLeads: number;
  totalDeals: number;
  totalMessages: number;
  totalRevenue: number;
  systemHealth: {
    database: boolean;
    redis: boolean;
    queue: boolean;
    storage: boolean;
    email: boolean;
  };
}

/** §4.1/§4.4 — mirrors `apps/api`'s `PlatformBillingDashboardSnapshot`. The second dashboard composition call — no single all-in-one endpoint exists. */
export interface PlatformBillingDashboardSnapshot {
  activeSubscriptions: number;
  trialExtensions: number;
  refundRequests: number;
  failedPayments: number;
  manualPayments: number;
  outstandingInvoices: number;
}

/** §4.2 — mirrors `apps/api`'s `PlatformWorkspaceSummary`. No `plan`/`trial status` fields exist here at all — those come only from a separate `/platform/subscriptions` join. No `GET /platform/workspaces/:id` single-record route exists either (list-only). */
export interface PlatformWorkspaceSummary {
  id: string;
  name: string;
  ownerId: string;
  status: WorkspaceStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  createdAt: string;
}

/** §4.4 — mirrors `apps/api`'s billing `SubscriptionSummary`, reused verbatim from the tenant Billing module (the platform routes read/write the exact same collection). */
export interface SubscriptionSummary {
  id: string;
  workspaceId: string;
  planId: string;
  pendingPlanId: string | null;
  status: SubscriptionStatus;
  startDate: string;
  renewalDate: string;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  cancelledAt: string | null;
  billingCycle: BillingCycle;
  autoRenew: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** §4.4 — mirrors `apps/api`'s billing `InvoiceSummary`. `amount`/`tax` nullable pending GTM pricing approval (TD-009), same as the tenant-facing Billing volume. */
export interface InvoiceSummary {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  invoiceNumber: string;
  amount: number | null;
  tax: number | null;
  currency: string;
  dueDate: string;
  issuedAt: string;
  paidAt: string | null;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
}

/** §4.4 — mirrors `apps/api`'s billing `PaymentSummary`. `verified`/`evidenceUrl` are genuinely meaningful here — this IS the platform-operator manual-recording flow those fields describe. */
export interface PaymentSummary {
  id: string;
  workspaceId: string;
  invoiceId: string;
  gateway: string;
  gatewayReference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: string | null;
  refundedAt: string | null;
  recordedBy: string;
  verified: boolean;
  evidenceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** §4.5 — mirrors `apps/api`'s `SupportTicketSummary`. Carries only `workspaceId`, never an embedded workspace/billing summary (BR-005) — the frontend composes those separately if needed. */
export interface SupportTicketSummary {
  id: string;
  workspaceId: string;
  title: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedOperator: string | null;
  resolution: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** §4.6 — mirrors `apps/api`'s `SupportSessionSummary`. The request and the session it becomes are the same record — `status` tracks the whole lifecycle. No "Reject" state exists — a `REQUESTED` session can only ever be approved (Architecture Review, 2026-08-12). */
export interface SupportSessionSummary {
  id: string;
  workspaceId: string;
  requestedBy: string;
  approvedBy: string | null;
  reason: string;
  durationMinutes: number;
  status: SupportSessionStatus;
  approvedAt: string | null;
  startedBy: string | null;
  startedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
  terminationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** §4.6 — mirrors `apps/api`'s `PlatformWorkspaceSummary`-adjacent member type, reused from Workspace's own `MemberSummary` for the read-only Break-Glass workspace overview. */
export interface WorkspaceMemberSummary {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: string;
  workspaceMemberStatus: string;
  createdAt: string;
}

/** §4.6 — mirrors `apps/api`'s `SettingsOverview` (a small subset consumed read-only during an active Break-Glass session — branding/preferences overview only, per `ADR-PLAT-005`). */
export interface SupportSettingsOverview {
  workspaceId: string;
  businessProfile: { category: string | null; description: string | null; gstin: string | null };
  branding: { logoUrl: string | null };
  preferences: { currency: string; dateFormat: string; timeFormat: string };
}

/** §4.6 — mirrors `apps/api`'s `SupportWorkspaceOverview`. The real "read-only tenant access" view an active Break-Glass session unlocks — composed, never a write surface. */
export interface SupportWorkspaceOverview {
  workspace: PlatformWorkspaceSummary;
  users: WorkspaceMemberSummary[];
  subscription: SubscriptionSummary;
  invoices: InvoiceSummary[];
  settingsOverview: SupportSettingsOverview;
}

/** §4.7 — mirrors `apps/api`'s `PlatformAuditEntrySummary`. Only Break-Glass + a curated subset of Platform Actions are native to this endpoint — Billing Operations and Workspace Actions live in their own owners' audit trails and are NOT merged in here (Architecture Review, 2026-08-12). */
export interface PlatformAuditEntrySummary {
  id: string;
  eventType: string;
  description: string;
  workspaceId: string | null;
  actorId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

/** §4.8 — mirrors `apps/api`'s `GovernancePolicyHistoryEntrySummary`. */
export interface GovernancePolicyHistoryEntrySummary {
  value: Record<string, unknown>;
  version: number;
  reason: string;
  updatedBy: string;
  updatedAt: string;
}

/** §4.8 — mirrors `apps/api`'s `GovernancePolicySummary`. `GET` returns `[]` until the first `PATCH` ever happens for a key — no seeded defaults exist. No "Violations" field/concept exists anywhere on the backend (Architecture Review, 2026-08-12) — dropped entirely, not represented here. Runtime enforcement is tracked as open TD-024, unrelated to this read/write surface. */
export interface GovernancePolicySummary {
  key: GovernancePolicyKey;
  value: Record<string, unknown>;
  version: number;
  reason: string;
  updatedBy: string;
  history: GovernancePolicyHistoryEntrySummary[];
  createdAt: string;
  updatedAt: string;
}

/** §4.8 — mirrors `apps/api`'s `PlatformComplianceSnapshot`. `auditCoverage` is a raw count, not a percentage — no denominator exists to compute one (`ADR-PLAT-008`). */
export interface PlatformComplianceSnapshot {
  breakGlassSessions: { total: number; active: number };
  platformLogins: { total: number; successful: number };
  failedLoginAttempts: number;
  permissionChanges: number;
  auditCoverage: number;
  dataRetentionStatus: { workspacesWithPolicy: number; totalWorkspaces: number };
  exportJobs: Record<string, number>;
}

/** §4.9 — mirrors `apps/api`'s `PlatformAnalyticsSnapshot`. Covers Platform KPIs (via a separate call)/Revenue/Workspace Growth only — "User Growth"/"Subscription Trends"/"Activity Trends" have no backend support anywhere and are not represented (Architecture Review, 2026-08-12). */
export interface PlatformAnalyticsSnapshot {
  totalWorkspaces: number;
  activeWorkspaces: number;
  archivedWorkspaces: number;
  platformUsers: number;
  activePlatformSessions: number;
  messagesProcessed: number;
  crmGrowth: { totalLeads: number; totalDeals: number; totalCustomers: number };
  revenueSummary: { totalRevenue: number };
}

/** §4.9 — mirrors `apps/api`'s `PlatformKpiSnapshot`. Calculated live, never persisted. */
export interface PlatformKpiSnapshot {
  workspaceGrowth: { newThisMonth: number; totalWorkspaces: number };
  revenueGrowth: { currentMonth: number; previousMonth: number };
  customerGrowth: { newThisMonth: number; totalCustomers: number };
  supportResolutionTimeHours: number | null;
  platformAvailability: { percentageUptime: number; note: string };
  featureAdoption: Array<{ flagKey: string; adoptionPercentage: number }>;
}

/** §4.10 — mirrors `apps/api`'s `PlatformAnnouncementSummary`. No status field exists — no Active/Scheduled/Expired distinction, no Publish/Archive routes (Architecture Review, 2026-08-12: minimal Create + List only). */
export interface PlatformAnnouncementSummary {
  id: string;
  title: string;
  message: string;
  targetType: AnnouncementTargetType;
  targetPlanIds: string[];
  targetWorkspaceIds: string[];
  createdBy: string;
  createdAt: string;
}

/** §4.11 — mirrors `apps/api`'s `PlatformFeatureFlagSummary`. `enabled: null` means "no platform override, inherits the workspace-level default" — a genuine third state, not just on/off. Always exactly 5 rows (one per `FeatureFlagKey`), the backend's own `list()` guarantees this. No per-workspace override management exists from the platform side (Architecture Review, 2026-08-12). */
export interface PlatformFeatureFlagSummary {
  flagKey: FeatureFlagKey;
  enabled: boolean | null;
}

/** §4.12 — mirrors `apps/api`'s `PlatformMaintenanceStatus`. `updatedBy`/`updatedAt` ("Started By"/"Started At") are persisted in Mongo but never returned by this endpoint — omitted here to match reality (Architecture Review, 2026-08-12). */
export interface PlatformMaintenanceStatus {
  enabled: boolean;
  reason: string | null;
}
