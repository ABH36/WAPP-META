"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission, WebhookEventType } from "@wapp/shared-types";
import { Alert, Button, EmptyState, Input, SkeletonCard, WebhookCard } from "@wapp/ui";
import { webhooksService, type CreateWebhookPayload } from "../../services/webhooks.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const EVENT_OPTIONS = Object.values(WebhookEventType);

const EMPTY_FORM: CreateWebhookPayload = { url: "", events: [] };

/**
 * FRD-001 Volume-7 §4.9 — `EDIT_WORKSPACE`. `secret` is shown exactly once,
 * only from Create — no rotate-secret route exists (unlike API Keys).
 * "Recent Deliveries" is deliberately absent — no `GET .../deliveries`
 * endpoint exists (Architecture Review, 2026-08-12); `WebhookCard` already
 * surfaces the only real delivery signal (`lastDeliveryAt`/`lastError`).
 */
export function WebhooksView(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.EDIT_WORKSPACE);
  const canEdit = useHasFullPermission(Permission.EDIT_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<CreateWebhookPayload>(EMPTY_FORM);
  const [generatedSecret, setGeneratedSecret] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const webhooksQuery = useQuery({
    queryKey: ["settings", "webhooks"],
    queryFn: () => webhooksService.list(),
    enabled: canView,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["settings", "webhooks"] });

  const toggleEvent = (event: WebhookEventType) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
    }));
  };

  const handleSubmit = async () => {
    if (!form.url.trim() || form.events.length === 0) return;
    setError(null);
    setBusy("submit");
    try {
      if (editingId) {
        await webhooksService.update(editingId, form);
      } else {
        const created = await webhooksService.create(form);
        setGeneratedSecret(created.secret);
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingId(null);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save webhook.");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    setError(null);
    setBusy(`toggle-${id}`);
    try {
      await webhooksService.update(id, { enabled });
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update webhook.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setBusy(`delete-${id}`);
    try {
      await webhooksService.remove(id);
      setConfirmDeleteId(null);
      await invalidate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete webhook.");
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Webhooks.</Alert>;
  }

  const webhooks = webhooksQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      {generatedSecret ? (
        <Alert variant="warning">
          <div className="flex flex-col gap-2">
            <p className="text-body-sm font-medium">
              Copy this signing secret now — it will never be shown again.
            </p>
            <code className="text-body-sm break-all rounded bg-neutral-900 p-2 text-neutral-50">
              {generatedSecret}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => setGeneratedSecret(null)}
            >
              I&apos;ve copied it
            </Button>
          </div>
        </Alert>
      ) : null}

      {canEdit ? (
        showForm ? (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <Input
              aria-label="Webhook URL"
              placeholder="https://example.com/webhook"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              {EVENT_OPTIONS.map((event) => (
                <label
                  key={event}
                  className="text-caption flex items-center gap-1 text-neutral-700 dark:text-neutral-300"
                >
                  <input
                    type="checkbox"
                    checked={form.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  {event}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={busy === "submit"}
                onClick={() => void handleSubmit()}
              >
                {editingId ? "Save changes" : "Create webhook"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-fit"
            onClick={() => setShowForm(true)}
          >
            New webhook
          </Button>
        )
      ) : null}

      {webhooksQuery.isLoading ? (
        <SkeletonCard />
      ) : webhooks.length === 0 ? (
        <EmptyState
          title="No webhooks"
          description="Create a webhook to receive real-time event notifications."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="flex flex-col gap-2">
              <WebhookCard
                url={webhook.url}
                status={webhook.status}
                enabled={webhook.enabled}
                events={webhook.events}
                lastDeliveryAt={webhook.lastDeliveryAt}
                lastError={webhook.lastError}
                onToggleEnabled={
                  canEdit ? (enabled) => void handleToggleEnabled(webhook.id, enabled) : undefined
                }
                onEdit={
                  canEdit
                    ? () => {
                        setForm({
                          url: webhook.url,
                          events: webhook.events,
                          retryCount: webhook.retryCount,
                          timeoutSeconds: webhook.timeoutSeconds,
                        });
                        setEditingId(webhook.id);
                        setShowForm(true);
                      }
                    : undefined
                }
                onDelete={canEdit ? () => setConfirmDeleteId(webhook.id) : undefined}
              />
              {confirmDeleteId === webhook.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-body-sm text-neutral-700 dark:text-neutral-300">
                    Delete this webhook?
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    loading={busy === `delete-${webhook.id}`}
                    onClick={() => void handleDelete(webhook.id)}
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
