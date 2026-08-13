import type { PlatformRole, WorkspaceStatus } from "@wapp/shared-types";
import type { AnnouncementTargetType } from "./schemas/platform-announcement.schema.js";
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "./schemas/support-ticket.schema.js";
import type { SupportSessionStatus } from "./schemas/support-session.schema.js";
import type { GovernancePolicyKey } from "./schemas/governance-policy.schema.js";
import type { SubscriptionSummary, InvoiceSummary } from "../billing/billing.types.js";
import type { SettingsOverview } from "../settings/settings.types.js";
import type { MemberSummary } from "../workspace/workspace.types.js";

/** PRD-007 Volume-1 — a distinct `type` discriminator from the tenant AccessTokenPayload's `"access"`, on top of the already-separate signing secret. */
export interface PlatformAccessTokenPayload {
  sub: string;
  role: PlatformRole;
  type: "platform_access";
}

export interface PlatformRefreshTokenPayload {
  sub: string;
  jti: string;
  type: "platform_refresh";
}

export interface AuthenticatedPlatformUser {
  platformUserId: string;
  role: PlatformRole;
}

/** PHD-001 Volume-1 (Security Hardening) — see identity.types.ts's `IssuedTokenPair` for the full rationale; identical treatment for the platform auth boundary. */
export interface IssuedPlatformTokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  rememberMe: boolean;
  expiresIn: number;
}

/** The only token-related fields ever returned in a client-visible JSON response. */
export interface PlatformAccessTokenIssued {
  accessToken: string;
  expiresIn: number;
}

export interface PlatformUserProfile {
  id: string;
  fullName: string;
  email: string;
  role: PlatformRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** §4.1 — the one place a WorkspaceDocument is flattened into what a Platform client is allowed to see. */
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

/** §4.4. */
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

/** §4.6 — Workspace Search's User result, deliberately minimal (no passwordHash, no internal fields). */
export interface PlatformSearchUserSummary {
  id: string;
  fullName: string;
  email: string;
  workspaceId: string | null;
  createdAt: string;
}

/** PRD-007 Volume-2 §4.6. */
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

/** PRD-007 Volume-3 §4.1/§4.2 — the request and the session it becomes are the same record. */
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

/** PRD-007 Volume-3 §4.4 — Global Audit Center. */
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

/** PRD-007 Volume-3 §4.5 — Investigation Timeline, a normalized read projection over 4 sources; it owns none of the underlying data. */
export interface InvestigationTimelineEntry {
  source: "PLATFORM_AUDIT" | "SETTINGS_AUDIT" | "BILLING_HISTORY" | "LOGIN_HISTORY";
  id: string;
  workspaceId: string;
  eventType: string;
  description: string;
  occurredAt: string;
}

/** PRD-007 Volume-3 §4.7 — Cross-Tenant Read Access, gated by an active Support Session. Composed from Volume-1/2's already-cross-tenant-capable services + a new Settings branding/preferences read (resolved scope: branding/preferences overview only — Integrations/Webhooks/API Keys/Feature Flags/Audit Logs/Data Management stay out of reach). */
export interface SupportWorkspaceOverview {
  workspace: PlatformWorkspaceSummary;
  users: MemberSummary[];
  subscription: SubscriptionSummary;
  invoices: InvoiceSummary[];
  settingsOverview: SettingsOverview;
}

/** PRD-007 Volume-4 §4.3/§4.6 — Governance Policy subsystem (merged, Architecture Review 2026-08-10). */
export interface GovernancePolicyHistoryEntrySummary {
  value: Record<string, unknown>;
  version: number;
  reason: string;
  updatedBy: string;
  updatedAt: string;
}

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

/** PRD-007 Volume-4 §4.1 — Platform Analytics Dashboard. Storage Usage/API Usage deliberately excluded (TD-013's existing commercial deferral). */
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

/**
 * PRD-007 Volume-4 §4.4 — Compliance Dashboard, read-only composition, no
 * new persistence beyond what Volume-3/4 already own. `auditCoverage` is
 * the total count of durable `PlatformAuditEntry` records (a volume
 * indicator that the audit trail is populated), not a percentage — see
 * docs/ADR-PLAT-008-platform-analytics-strategy.md for why a precise
 * "% of events covered" formula was rejected as ill-defined.
 */
export interface PlatformComplianceSnapshot {
  breakGlassSessions: { total: number; active: number };
  platformLogins: { total: number; successful: number };
  failedLoginAttempts: number;
  permissionChanges: number;
  auditCoverage: number;
  dataRetentionStatus: { workspacesWithPolicy: number; totalWorkspaces: number };
  exportJobs: Record<string, number>;
}

/** PRD-007 Volume-4 §4.5 — Platform KPIs, calculated live, never persisted (BR-006). */
export interface PlatformKpiSnapshot {
  workspaceGrowth: { newThisMonth: number; totalWorkspaces: number };
  revenueGrowth: { currentMonth: number; previousMonth: number };
  customerGrowth: { newThisMonth: number; totalCustomers: number };
  supportResolutionTimeHours: number | null;
  platformAvailability: { percentageUptime: number; note: string };
  featureAdoption: Array<{ flagKey: string; adoptionPercentage: number }>;
}
