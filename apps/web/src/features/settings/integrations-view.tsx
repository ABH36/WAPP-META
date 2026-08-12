"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import {
  Alert,
  Button,
  IntegrationCard,
  Input,
  Select,
  SettingsSection,
  SkeletonCard,
  StageBadge,
  Switch,
} from "@wapp/ui";
import {
  integrationsService,
  type UpdateEmailIntegrationPayload,
} from "../../services/integrations.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { EmailEncryption, EmailProvider, ThirdPartyAppKey } from "../../types/settings";

const THIRD_PARTY_APP_LABELS: Record<ThirdPartyAppKey, string> = {
  [ThirdPartyAppKey.ZAPIER]: "Zapier",
  [ThirdPartyAppKey.MAKE]: "Make",
  [ThirdPartyAppKey.PABBLY]: "Pabbly",
  [ThirdPartyAppKey.CUSTOM]: "Custom",
};

const EMPTY_EMAIL_FORM: UpdateEmailIntegrationPayload = {
  provider: EmailProvider.SMTP,
  host: "",
  port: 587,
  username: "",
  credential: "",
  encryption: EmailEncryption.TLS,
  fromAddress: "",
};

/**
 * FRD-001 Volume-7 §4.7 — `EDIT_WORKSPACE`. No generic Integrations
 * abstraction on the backend (a hand-composed overview over 3 independent
 * services) — this screen mirrors that, one section per integration type.
 * No WhatsApp "Connect" button — Meta Embedded Signup (JS SDK/OAuth
 * popup) is out of scope this volume (Architecture Review, 2026-08-12,
 * filed as Tech Debt); only Disconnect/Test/Refresh act on an
 * already-connected WABA.
 */
export function IntegrationsView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.EDIT_WORKSPACE);
  const canEdit = useHasFullPermission(Permission.EDIT_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [emailForm, setEmailForm] = React.useState<UpdateEmailIntegrationPayload>(EMPTY_EMAIL_FORM);
  const [testResult, setTestResult] = React.useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["settings", "integrations"],
    queryFn: () => integrationsService.overview(),
    enabled: canView,
  });
  const healthQuery = useQuery({
    queryKey: ["settings", "integration-health"],
    queryFn: () => integrationsService.health(),
    enabled: canView,
  });

  React.useEffect(() => {
    if (overviewQuery.data?.email.configured) {
      setEmailForm({
        provider: overviewQuery.data.email.provider ?? EmailProvider.SMTP,
        host: overviewQuery.data.email.host ?? "",
        port: overviewQuery.data.email.port ?? 587,
        username: overviewQuery.data.email.username ?? "",
        credential: "",
        encryption: overviewQuery.data.email.encryption ?? EmailEncryption.TLS,
        fromAddress: overviewQuery.data.email.fromAddress ?? "",
      });
    }
  }, [overviewQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["settings", "integrations"] });
    void queryClient.invalidateQueries({ queryKey: ["settings", "integration-health"] });
  };

  const handleTestWhatsApp = async () => {
    setError(null);
    setBusy("whatsapp-test");
    try {
      const result = await integrationsService.testWhatsAppConnection();
      setTestResult(result.error ? `Failed: ${result.error}` : `Connected (${result.status})`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to test WhatsApp connection.");
    } finally {
      setBusy(null);
    }
  };

  const handleDisconnectWhatsApp = async () => {
    setError(null);
    setBusy("whatsapp-disconnect");
    try {
      await integrationsService.disconnectWhatsApp();
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to disconnect WhatsApp.");
    } finally {
      setBusy(null);
    }
  };

  const handleRefreshWhatsApp = async () => {
    setError(null);
    setBusy("whatsapp-refresh");
    try {
      await integrationsService.refreshWhatsAppMetadata();
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh WhatsApp metadata.");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveEmail = async () => {
    setError(null);
    setBusy("email-save");
    try {
      await integrationsService.updateEmailIntegration(emailForm);
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save email integration.");
    } finally {
      setBusy(null);
    }
  };

  const handleTestEmail = async () => {
    setError(null);
    setBusy("email-test");
    try {
      const result = await integrationsService.testEmailIntegration();
      setTestResult(result.success ? "Connection succeeded" : `Failed: ${result.error}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to test email connection.");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleApp = async (appKey: ThirdPartyAppKey, enabled: boolean) => {
    setError(null);
    setBusy(`app-${appKey}`);
    try {
      await integrationsService.toggleThirdPartyApp(appKey, enabled);
      invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update app.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Integrations.</Alert>;
  }

  if (overviewQuery.isLoading || !overviewQuery.data) {
    return <SkeletonCard />;
  }

  const overview = overviewQuery.data;

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}
      {testResult ? <Alert variant="info">{testResult}</Alert> : null}

      <IntegrationCard
        name="WhatsApp Business"
        status={overview.whatsapp.status ?? "DISCONNECTED"}
        description={
          overview.whatsapp.connected
            ? `Connected as ${overview.whatsapp.businessName ?? overview.whatsapp.wabaId}`
            : "Not connected"
        }
        actions={
          canEdit && overview.whatsapp.connected ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={busy === "whatsapp-test"}
                onClick={() => void handleTestWhatsApp()}
              >
                Test Connection
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={busy === "whatsapp-refresh"}
                onClick={() => void handleRefreshWhatsApp()}
              >
                Refresh Metadata
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                loading={busy === "whatsapp-disconnect"}
                onClick={() => void handleDisconnectWhatsApp()}
              >
                Disconnect
              </Button>
            </>
          ) : null
        }
      />

      {canEdit ? (
        <SettingsSection
          title="Email Integration"
          description="Config and test only — this does not replace the app's own outbound email pipeline"
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={busy === "email-test"}
              onClick={() => void handleTestEmail()}
            >
              Test Connection
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              aria-label="Provider"
              value={emailForm.provider}
              onChange={(e) =>
                setEmailForm((f) => ({ ...f, provider: e.target.value as EmailProvider }))
              }
            >
              <option value={EmailProvider.SMTP}>SMTP</option>
              <option value={EmailProvider.MICROSOFT_365}>Microsoft 365</option>
              <option value={EmailProvider.GOOGLE_WORKSPACE}>Google Workspace</option>
            </Select>
            <Select
              aria-label="Encryption"
              value={emailForm.encryption}
              onChange={(e) =>
                setEmailForm((f) => ({ ...f, encryption: e.target.value as EmailEncryption }))
              }
            >
              <option value={EmailEncryption.NONE}>None</option>
              <option value={EmailEncryption.SSL}>SSL</option>
              <option value={EmailEncryption.TLS}>TLS</option>
            </Select>
            <Input
              aria-label="Host"
              placeholder="Host"
              value={emailForm.host}
              onChange={(e) => setEmailForm((f) => ({ ...f, host: e.target.value }))}
            />
            <Input
              aria-label="Port"
              type="number"
              placeholder="Port"
              value={emailForm.port}
              onChange={(e) => setEmailForm((f) => ({ ...f, port: Number(e.target.value) }))}
            />
            <Input
              aria-label="Username"
              placeholder="Username"
              value={emailForm.username}
              onChange={(e) => setEmailForm((f) => ({ ...f, username: e.target.value }))}
            />
            <Input
              aria-label="Credential"
              type="password"
              placeholder="Password / API key"
              value={emailForm.credential}
              onChange={(e) => setEmailForm((f) => ({ ...f, credential: e.target.value }))}
            />
            <Input
              aria-label="From address"
              type="email"
              placeholder="From address"
              value={emailForm.fromAddress}
              onChange={(e) => setEmailForm((f) => ({ ...f, fromAddress: e.target.value }))}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-fit"
            loading={busy === "email-save"}
            onClick={() => void handleSaveEmail()}
          >
            Save
          </Button>
        </SettingsSection>
      ) : null}

      <SettingsSection title="Third-party Apps">
        <div className="flex flex-col gap-2">
          {overview.thirdPartyApps.map((app) => (
            <div
              key={app.appKey}
              className="flex items-center justify-between gap-2 border-b border-neutral-200 py-2 last:border-b-0 dark:border-neutral-800"
            >
              <span className="text-body-sm text-neutral-900 dark:text-neutral-50">
                {THIRD_PARTY_APP_LABELS[app.appKey]}
              </span>
              <Switch
                checked={app.enabled}
                disabled={!canEdit}
                onCheckedChange={(value) => void handleToggleApp(app.appKey, value)}
                aria-label={THIRD_PARTY_APP_LABELS[app.appKey]}
              />
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Integration Health">
        {healthQuery.isLoading || !healthQuery.data ? (
          <SkeletonCard />
        ) : (
          <div className="flex flex-col gap-2">
            {healthQuery.data.entries.map((entry) => (
              <div
                key={entry.integration}
                className="flex items-center justify-between gap-2 border-b border-neutral-200 py-2 last:border-b-0 dark:border-neutral-800"
              >
                <span className="text-body-sm text-neutral-900 dark:text-neutral-50">
                  {entry.integration}
                </span>
                <StageBadge value={entry.status} />
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
