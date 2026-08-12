import type { SidebarState, Theme, UiDensity, WebhookEventType } from "@wapp/shared-types";
import type { BusinessHours, BusinessProfile, WorkspaceNotificationSettings } from "./workspace";

/** FRD-001 Volume-3 §4.4 — mirrors `apps/api`'s `SettingsOverview.branding`. Logo is the entirety of Branding today (ADR-SET-002) — no colors/theme fields exist. */
export interface SettingsBranding {
  logoUrl: string | null;
}

/** FRD-001 Volume-3 §4.5 — mirrors `apps/api`'s `SettingsOverview.preferences`. These are workspace *defaults*; a user's own Profile settings (FRD-001 Volume-2) may override `dateFormat`/`timeFormat` individually (ADR-SET-003). */
export interface SettingsPreferences {
  currency: string;
  dateFormat: string;
  timeFormat: string;
}

/**
 * FRD-001 Volume-3 §4.2/§4.3/§4.4/§4.5/§4.6 — mirrors `apps/api`'s
 * `SettingsOverview` (`settings.types.ts`) field-for-field. This is the
 * single read every `/workspace/*` management page uses (`GET /settings`)
 * — `businessProfile`/`businessHours`/`notificationSettings`/`language`
 * are Settings' read-only composition of the Workspace module's own data
 * (ADR-SET-001); only `branding`/`preferences` are actually owned/written
 * by Settings.
 */
export interface SettingsOverview {
  workspaceId: string;
  businessProfile: BusinessProfile;
  businessHours: BusinessHours;
  notificationSettings: WorkspaceNotificationSettings;
  language: string;
  branding: SettingsBranding;
  preferences: SettingsPreferences;
}

/** FRD-001 Volume-3 §4.4 — mirrors `apps/api`'s `LogoUploadSignature`. A Cloudinary direct-upload signature (SEC-016) — file bytes never touch the API. */
export interface LogoUploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/**
 * FRD-001 Volume-7 — the enums below have no `@wapp/shared-types`
 * equivalent (confirmed by grep across the whole package) — they're
 * defined only locally in `apps/api/src/modules/settings/schemas/*.ts`
 * and `apps/api/src/modules/identity/schemas/api-key.schema.ts`. Mirrored
 * here as local string-literal-backed enums rather than imported, same
 * discipline Communication's Volume-4 established for genuinely
 * backend-local types (never invent a shared-types entry that doesn't
 * exist). `Theme`/`SidebarState`/`UiDensity`/`WebhookEventType` DO exist
 * in `@wapp/shared-types` and are imported directly instead.
 */
export enum ApiKeyScope {
  READ = "READ",
  WRITE = "WRITE",
}

export enum ApiKeyStatus {
  ACTIVE = "ACTIVE",
  REVOKED = "REVOKED",
}

export enum IntegrationConnectionStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
  EXPIRED = "EXPIRED",
}

export enum WhatsAppConnectionStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
}

export enum EmailProvider {
  SMTP = "SMTP",
  MICROSOFT_365 = "MICROSOFT_365",
  GOOGLE_WORKSPACE = "GOOGLE_WORKSPACE",
}

export enum EmailEncryption {
  NONE = "NONE",
  SSL = "SSL",
  TLS = "TLS",
}

export enum ThirdPartyAppKey {
  ZAPIER = "ZAPIER",
  MAKE = "MAKE",
  PABBLY = "PABBLY",
  CUSTOM = "CUSTOM",
}

export enum AuditCategory {
  AUTHENTICATION = "AUTHENTICATION",
  WORKSPACE = "WORKSPACE",
  CRM = "CRM",
  COMMUNICATION = "COMMUNICATION",
  BILLING = "BILLING",
  SETTINGS = "SETTINGS",
  INTEGRATIONS = "INTEGRATIONS",
}

export enum AuditResult {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
}

export enum ExportEntityType {
  CUSTOMERS = "CUSTOMERS",
  LEADS = "LEADS",
  DEALS = "DEALS",
  ACTIVITIES = "ACTIVITIES",
  BILLING = "BILLING",
  SETTINGS = "SETTINGS",
}

/** Distinct from `types/billing.ts`'s lowercase `ExportFormat` string union — Settings' own export format is a separate uppercase enum on a separate backend DTO, never the same type. */
export enum SettingsExportFormat {
  CSV = "CSV",
  EXCEL = "EXCEL",
  JSON = "JSON",
}

export enum ExportJobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/** FRD-001 Volume-7 §4.2/§9 — the resolved value after applying User Override → Workspace Default precedence; `source` tells the caller which one won, computed server-side (`ADR-SET-003`). */
export interface EffectiveFormatSummary {
  value: string;
  source: "USER" | "WORKSPACE";
}

export interface NotificationEventPreferenceSummary {
  inApp: boolean;
  email: boolean;
}

/** FRD-001 Volume-7 §4.4/§4.5 — the 7 personal, per-event×channel notification preferences (distinct from Workspace's own 4-toggle `notificationSettings`, FRD-001 Volume-3). */
export interface UserNotificationPreferencesSummary {
  newAssignment: NotificationEventPreferenceSummary;
  newLead: NotificationEventPreferenceSummary;
  dealWon: NotificationEventPreferenceSummary;
  mention: NotificationEventPreferenceSummary;
  taskReminder: NotificationEventPreferenceSummary;
  followUpReminder: NotificationEventPreferenceSummary;
  billingReminder: NotificationEventPreferenceSummary;
}

/** FRD-001 Volume-7 §4.4 — mirrors `apps/api`'s `UserSettingsOverview`. `timezone` is read-only, inherited from Workspace. This is the real, previously-unconsumed backend this volume migrates Theme/Sidebar/Density onto (Architecture Review, 2026-08-12). */
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

/** FRD-001 Volume-7 §4.7 — mirrors `apps/api`'s `WhatsAppIntegrationSummary`. Read-through composition of Communication's own connection state (ADR-SET-005) — Settings never owns it. No "Connect" action is built this volume (Meta Embedded Signup is a substantial standalone integration with no App ID/SDK configured anywhere in this app — filed as Tech Debt, Architecture Review 2026-08-12); Disconnect/Test Connection/Refresh Metadata act on an already-connected WABA. */
export interface WhatsAppIntegrationSummary {
  connected: boolean;
  wabaId: string | null;
  businessName: string | null;
  status: WhatsAppConnectionStatus | null;
}

/** FRD-001 Volume-7 §4.7 — mirrors `apps/api`'s `EmailIntegrationSummary`. `configured: false` means every other field is null. Config/test-only — not wired to the app's actual outbound email pipeline (that stays the existing global Resend send path). */
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

/** FRD-001 Volume-7 §4.9 — mirrors `apps/api`'s `WebhookSummary`. `lastDeliveryAt`/`lastError` are the only delivery-history fields exposed anywhere — no `GET .../deliveries` list endpoint exists (filed as Tech Debt). */
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

/** FRD-001 Volume-7 §4.7 — mirrors `apps/api`'s `IntegrationsOverview`. A hand-composed read-through DTO over three independent services (WhatsApp/Email/Webhooks), not a generic polymorphic Integration model — each integration type keeps its own bespoke routes/permissions. */
export interface IntegrationsOverview {
  workspaceId: string;
  whatsapp: WhatsAppIntegrationSummary;
  email: EmailIntegrationSummary;
  webhookCount: number;
  apiKeyCount: number;
  thirdPartyApps: ThirdPartyAppSummary[];
}

/** FRD-001 Volume-7 §4.7 — mirrors `apps/api`'s `IntegrationHealthEntry`. `integration` is a stable identifier string: `"WHATSAPP"`, `"EMAIL"`, or `"WEBHOOK:{id}"`. The WhatsApp entry's `lastSyncAt`/`lastError` are hardcoded `null` server-side (not real telemetry) — rendered as-is, never implied as live. */
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

/** FRD-001 Volume-7 §4.8 — mirrors `apps/api`'s `ApiKeySummary` (`identity.types.ts`). Never includes `keyHash` or the raw secret. */
export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scope: ApiKeyScope;
  status: ApiKeyStatus;
  createdBy: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** FRD-001 Volume-7 §4.8 — mirrors `apps/api`'s `GeneratedApiKey`. `rawKey` is shown exactly once (BR-004/backend's own BR-007) — never persisted client-side beyond the single confirmation render. */
export interface GeneratedApiKey {
  apiKey: ApiKeySummary;
  rawKey: string;
}

/** FRD-001 Volume-7 §4.10 — mirrors `apps/api`'s `AuditLogEntrySummary`. `AUTHENTICATION`-category entries are composed at read time from Identity's Login History, not a second persisted copy — same shape, different source, invisible to this type. */
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

/** FRD-001 Volume-7 §4.11 — mirrors `apps/api`'s `ExportJobSummary`. `resultUrl` is a direct Storage URL, not a proxied API download — the frontend never streams the file through the API itself. */
export interface ExportJobSummary {
  id: string;
  entityType: ExportEntityType;
  format: SettingsExportFormat;
  status: ExportJobStatus;
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
}

export interface DiagnosticCheck {
  name: string;
  status: "UP" | "DOWN";
}

/** FRD-001 Volume-7 §4.12 — mirrors `apps/api`'s `DiagnosticsSummary`. Five of six checks (database/redis/queue/storage/email) are platform-level, identical for every workspace; only `whatsapp` is workspace-specific. */
export interface DiagnosticsSummary {
  workspaceId: string;
  checks: DiagnosticCheck[];
  checkedAt: string;
}

export enum ConfigHistoryArea {
  BRANDING = "BRANDING",
  PREFERENCES = "PREFERENCES",
  BUSINESS_HOURS = "BUSINESS_HOURS",
  NOTIFICATION_SETTINGS = "NOTIFICATION_SETTINGS",
  INTEGRATIONS = "INTEGRATIONS",
  FEATURE_FLAGS = "FEATURE_FLAGS",
}

/** FRD-001 Volume-7 §4.1 — mirrors `apps/api`'s `ConfigHistoryEntrySummary`. Powers Settings Home's "Recent configuration summary" — append-only, `previousValue` is the prior entry's `newValue` for the same area, or null on the first change ever recorded. */
export interface ConfigHistoryEntrySummary {
  id: string;
  area: ConfigHistoryArea;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  changedBy: string;
  createdAt: string;
}
