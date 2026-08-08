import type { SidebarState, Theme, UiDensity, WebhookEventType } from "@wapp/shared-types";
import type { WhatsAppConnectionStatus } from "../communication/schemas/whatsapp-connection.schema.js";
import type { EmailEncryption, EmailProvider } from "./schemas/email-integration.schema.js";
import type { IntegrationConnectionStatus } from "./schemas/integration-status.enum.js";
import type { ThirdPartyAppKey } from "./schemas/third-party-app.schema.js";

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
