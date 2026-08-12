import type { WebhookEventType } from "@wapp/shared-types";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import type { WebhookSummary } from "../types/settings";

export interface CreateWebhookPayload {
  url: string;
  enabled?: boolean;
  retryCount?: number;
  timeoutSeconds?: number;
  events: WebhookEventType[];
}

export type UpdateWebhookPayload = Partial<CreateWebhookPayload>;

/**
 * FRD-001 Volume-7 §4.9 — `EDIT_WORKSPACE`. The signing secret is returned
 * exactly once, only from `create()` — no rotate-secret route exists (`edit`
 * never returns it again). No `deliveries()` method exists — the backend has
 * a real `webhook_delivery_logs` collection but zero API routes exposing it
 * (Architecture Review, 2026-08-12: show `WebhookSummary.lastDeliveryAt`/
 * `lastError` only, filed as Tech Debt).
 */
export const webhooksService = {
  list(): Promise<WebhookSummary[]> {
    return apiGet("/settings/webhooks");
  },

  create(payload: CreateWebhookPayload): Promise<{ webhook: WebhookSummary; secret: string }> {
    return apiPost("/settings/webhooks", payload);
  },

  update(id: string, payload: UpdateWebhookPayload): Promise<WebhookSummary> {
    return apiPatch(`/settings/webhooks/${id}`, payload);
  },

  remove(id: string): Promise<void> {
    return apiDelete(`/settings/webhooks/${id}`);
  },
};
