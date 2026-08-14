import type { SidebarState, Theme, UiDensity, WebhookEventType } from "@wapp/shared-types";
import type { WhatsAppConnectionStatus } from "../communication/schemas/whatsapp-connection.schema.js";
import type { EmailEncryption, EmailProvider } from "./schemas/email-integration.schema.js";
import type { IntegrationConnectionStatus } from "./schemas/integration-status.enum.js";
import type { ThirdPartyAppKey } from "./schemas/third-party-app.schema.js";
import type { AuditCategory, AuditResult } from "./schemas/audit-log-entry.schema.js";
import type { ConfigHistoryArea } from "./schemas/config-history-entry.schema.js";
import type {
  ExportEntityType,
  ExportFormat,
  ExportJobStatus,
} from "./schemas/export-job.schema.js";
import type { FeatureFlagKey } from "./schemas/feature-flag-state.schema.js";

export interface LogoUploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/**
 * §2 — the "unified configuration experience." Orchestrated fields
 * (businessProfile/businessHours/notificationSettings/language) are read
 * straight from Workspace, never duplicated or cached here; Settings only
 * owns branding/preferences. Writes to the orchestrated fields go through
 * Workspace's own existing endpoints unchanged — this type is read-only
 * composition, not a parallel write path. See
 * docs/ADR-SET-001-settings-ownership-strategy.md.
 */
export interface SettingsOverview {
  workspaceId: string;
  businessProfile: {
    category: string | null;
    description: string | null;
    gstin: string | null;
  };
  businessHours: {
    timezone: string;
    schedule: Array<{
      dayOfWeek: number;
      isOpen: boolean;
      openTime: string;
      closeTime: string;
    }>;
    publicHolidays: Array<{ date: string; name: string }>;
  };
  notificationSettings: {
    taskFollowUpReminder: boolean;
    conversationLeadAssignment: boolean;
    broadcastCompleted: boolean;
    subscriptionReminder: boolean;
  };
  // Read-only in Volume-1 — no selector endpoint exists yet (ADR-027,
  // TD-017: full localization deferred to a dedicated initiative).
  language: string;
  branding: {
    logoUrl: string | null;
  };
  preferences: {
    currency: string;
    dateFormat: string;
    timeFormat: string;
  };
}

export interface NotificationEventPreferenceSummary {
  inApp: boolean;
  email: boolean;
}

export interface UserNotificationPreferencesSummary {
  newAssignment: NotificationEventPreferenceSummary;
  newLead: NotificationEventPreferenceSummary;
  dealWon: NotificationEventPreferenceSummary;
  mention: NotificationEventPreferenceSummary;
  taskReminder: NotificationEventPreferenceSummary;
  followUpReminder: NotificationEventPreferenceSummary;
  billingReminder: NotificationEventPreferenceSummary;
}

/**
 * §4.2 / ADR-SET-003 — the resolved value after applying the User Override
 * -> Workspace Default precedence. `source` tells the caller which one won,
 * without them having to re-derive it client-side.
 */
export interface EffectiveFormatSummary {
  value: string;
  source: "USER" | "WORKSPACE";
}

/**
 * PRD-006 Volume-2 §2/§3. `dateFormat`/`timeFormat` are the *effective*
 * (already-resolved) values; `timezone` stays read-only, inherited
 * straight from Workspace (§4.2 — "Read only. Inherited from Workspace"),
 * unchanged from Volume-1.
 */
export interface UserSettingsOverview {
  userId: string;
  theme: Theme;
  sidebar: SidebarState;
  density: UiDensity;
  dateFormat: EffectiveFormatSummary;
  timeFormat: EffectiveFormatSummary;
  timezone: string;
  defaultLandingPage: string | null;
  pinnedPages: string[];
  favoriteModules: string[];
  notifications: UserNotificationPreferencesSummary;
}

/**
 * PRD-006 Volume-3 §4.1 — Settings never owns connection state (ADR-SET-001
 * pattern extended to Communication in ADR-SET-005); this is a read-through
 * composition of WhatsAppConnectionService.getConnection(), same as
 * SettingsOverview's businessProfile/businessHours composition from
 * Workspace in Volume-1.
 */
export interface WhatsAppIntegrationSummary {
  connected: boolean;
  wabaId: string | null;
  businessName: string | null;
  status: WhatsAppConnectionStatus | null;
}

/** §4.2 — `configured: false` means every other field is null (no config saved yet). */
export interface EmailIntegrationSummary {
  configured: boolean;
  provider: EmailProvider | null;
  host: string | null;
  port: number | null;
  username: string | null;
  encryption: EmailEncryption | null;
  fromAddress: string | null;
  status: IntegrationConnectionStatus | null;
  lastTestedAt: string | null;
  lastError: string | null;
}

export interface WebhookSummary {
  id: string;
  url: string;
  enabled: boolean;
  retryCount: number;
  timeoutSeconds: number;
  events: WebhookEventType[];
  status: IntegrationConnectionStatus;
  lastDeliveryAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface ThirdPartyAppSummary {
  appKey: ThirdPartyAppKey;
  enabled: boolean;
}

/** §2 — the "centralized configuration" overview. Composes read-only summaries from every integration sub-service, owns none of their state itself. */
export interface IntegrationsOverview {
  workspaceId: string;
  whatsapp: WhatsAppIntegrationSummary;
  email: EmailIntegrationSummary;
  webhookCount: number;
  apiKeyCount: number;
  thirdPartyApps: ThirdPartyAppSummary[];
}

/** §4.7 — read-only dashboard. `integration` is a stable identifier: "WHATSAPP", "EMAIL", or "WEBHOOK:{id}". */
export interface IntegrationHealthEntry {
  integration: string;
  status: IntegrationConnectionStatus;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface IntegrationHealthSummary {
  workspaceId: string;
  entries: IntegrationHealthEntry[];
}

/**
 * PRD-006 Volume-4 §4.1. AUTHENTICATION-category entries are composed from
 * Identity's `LoginHistoryEntry` at read time (`AuthService.
 * getWorkspaceLoginHistory`), never a second persisted copy — same shape,
 * different source, so the API surface doesn't leak that distinction.
 */
export interface AuditLogEntrySummary {
  id: string;
  category: AuditCategory;
  actorId: string | null;
  module: string;
  entity: string | null;
  entityId: string | null;
  action: string;
  result: AuditResult;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntrySummary[];
  total: number;
  page: number;
  limit: number;
}

/** §4.2 — `previousValue` is the prior entry's `newValue` for the same (workspaceId, area), or null on the first change ever recorded. */
export interface ConfigHistoryEntrySummary {
  id: string;
  area: ConfigHistoryArea;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  changedBy: string;
  createdAt: string;
}

export interface ExportJobSummary {
  id: string;
  entityType: ExportEntityType;
  format: ExportFormat;
  status: ExportJobStatus;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
}

/** §4.4 — days, 30-3650 (§10). */
export interface RetentionPolicySummary {
  auditLogRetentionDays: number;
  loginHistoryRetentionDays: number;
  notificationHistoryRetentionDays: number;
  webhookDeliveryLogRetentionDays: number;
}

export interface FeatureFlagSummary {
  flagKey: FeatureFlagKey;
  enabled: boolean;
}

export interface SystemPreferencesSummary {
  defaultPagination: number;
  exportFormat: ExportFormat;
  dashboardRefreshInterval: number;
}

export interface DiagnosticCheck {
  name: string;
  status: "UP" | "DOWN";
}

/** PHD-001 Volume-2 §4.14 — one entry per BullMQ queue in the system. */
export interface DiagnosticsQueueEntry {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  workers: number;
}

/** PHD-001 Volume-2 §4.14. */
export interface DiagnosticsCacheStatus {
  connected: boolean;
  usedMemoryBytes: number | null;
}

/** §4.7 — read-only. Platform-level checks (database/redis/queue/storage/email) are the same for every workspace; whatsapp is workspace-specific, reusing Volume-3's IntegrationHealthService. Extended by PHD-001 Volume-2 §4.14: buildVersion/gitCommit/environment/queues/cache/activeWorkers are platform-level (same for every workspace, like `checks`); featureFlags reuses Volume-4's FeatureFlagsService.list() and stays workspace-specific. */
export interface DiagnosticsSummary {
  workspaceId: string;
  checks: DiagnosticCheck[];
  checkedAt: string;
  buildVersion: string;
  gitCommit: string;
  environment: string;
  featureFlags: FeatureFlagSummary[];
  queues: DiagnosticsQueueEntry[];
  cache: DiagnosticsCacheStatus;
  activeWorkers: number;
}
