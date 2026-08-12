import { apiGet, apiPatch, apiPost } from "../lib/api";
import type {
  EmailEncryption,
  EmailIntegrationSummary,
  EmailProvider,
  IntegrationHealthSummary,
  IntegrationsOverview,
  ThirdPartyAppKey,
  ThirdPartyAppSummary,
} from "../types/settings";

export interface UpdateEmailIntegrationPayload {
  provider: EmailProvider;
  host: string;
  port: number;
  username: string;
  credential: string;
  encryption: EmailEncryption;
  fromAddress: string;
}

export interface TestEmailResult {
  success: boolean;
  error: string | null;
}

/**
 * FRD-001 Volume-7 §4.7 — all routes `EDIT_WORKSPACE`. No generic
 * "Integrations" abstraction on the backend — this file's shape mirrors
 * the real three-independent-services composition (WhatsApp/Email/
 * Third-party apps), not a uniform CRUD model. No `connectWhatsApp()`
 * method exists here on purpose — Meta Embedded Signup (JS SDK, OAuth
 * popup, postMessage handshake) is out of scope this volume (Architecture
 * Review, 2026-08-12); only Disconnect/Test/Refresh act on an
 * already-connected WABA.
 */
export const integrationsService = {
  overview(): Promise<IntegrationsOverview> {
    return apiGet("/settings/integrations");
  },

  health(): Promise<IntegrationHealthSummary> {
    return apiGet("/settings/integration-health");
  },

  testWhatsAppConnection(): Promise<{
    status: string;
    verifiedName: string | null;
    error: string | null;
  }> {
    return apiPost("/settings/integrations/whatsapp/test-connection");
  },

  disconnectWhatsApp(): Promise<unknown> {
    return apiPost("/settings/integrations/whatsapp/disconnect");
  },

  refreshWhatsAppMetadata(): Promise<unknown> {
    return apiPost("/settings/integrations/whatsapp/refresh-metadata");
  },

  updateEmailIntegration(payload: UpdateEmailIntegrationPayload): Promise<EmailIntegrationSummary> {
    return apiPatch("/settings/integrations/email", payload);
  },

  testEmailIntegration(): Promise<TestEmailResult> {
    return apiPost("/settings/integrations/email/test");
  },

  listThirdPartyApps(): Promise<ThirdPartyAppSummary[]> {
    return apiGet("/settings/integrations/apps");
  },

  toggleThirdPartyApp(appKey: ThirdPartyAppKey, enabled: boolean): Promise<ThirdPartyAppSummary> {
    return apiPatch(`/settings/integrations/apps/${appKey}`, { enabled });
  },
};
