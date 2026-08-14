import { Injectable } from "@nestjs/common";
import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from "prom-client";

/**
 * PHD-001 Volume-2 (Observability, Monitoring & Logging) §4.3 — every named
 * metric category from the approved planning document, on one shared
 * `prom-client` registry exposed via `MetricsController`'s `GET /metrics`
 * (Prometheus text exposition format — provider-neutral: any scraper, not
 * just Prometheus itself, can consume this format; no vendor/backend is
 * deployed or picked here, per the Architecture Review's "provider-neutral"
 * constraint). `collectDefaultMetrics()` covers Infrastructure's CPU/Memory/
 * Event Loop for free, standard prom-client behavior — no hand-rolled code
 * needed for those three.
 *
 * Deliberately NOT labeled by `workspaceId` anywhere in this file (flagged
 * as a real cardinality/scalability risk during Architecture Review) — a
 * label cardinality that grows with the tenant count is exactly how a
 * Prometheus-style backend falls over. Workspace-level detail belongs in
 * logs/traces/audit records, which don't have the same cardinality
 * constraint, not in metric labels.
 */
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  // ---- HTTP (§4.3 "HTTP": Request Count, Latency, Error Rate) ----
  // Error rate is derived at query time from the `status` label, not a
  // separate counter — standard Prometheus practice.
  readonly httpRequestsTotal = new Counter({
    name: "wapp_http_requests_total",
    help: "Total HTTP requests handled by the API",
    labelNames: ["method", "route", "status"] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: "wapp_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  // ---- Authentication (§4.3 "Authentication") ----
  readonly authLoginSuccessTotal = new Counter({
    name: "wapp_auth_login_success_total",
    help: "Successful logins",
    labelNames: ["actor"] as const, // "tenant" | "platform"
    registers: [this.registry],
  });

  readonly authLoginFailureTotal = new Counter({
    name: "wapp_auth_login_failure_total",
    help: "Failed login attempts",
    labelNames: ["actor", "reason"] as const,
    registers: [this.registry],
  });

  readonly authTokenRefreshTotal = new Counter({
    name: "wapp_auth_token_refresh_total",
    help: "Refresh-token rotations",
    labelNames: ["actor"] as const,
    registers: [this.registry],
  });

  readonly authSessionRevocationTotal = new Counter({
    name: "wapp_auth_session_revocation_total",
    help: "Session revocations (logout, reuse-detection, admin action)",
    labelNames: ["actor", "reason"] as const,
    registers: [this.registry],
  });

  // ---- Communication (§4.3 "Communication") ----
  readonly communicationMessagesTotal = new Counter({
    name: "wapp_communication_messages_total",
    help: "WhatsApp messages processed",
    labelNames: ["direction"] as const, // "inbound" | "outbound"
    registers: [this.registry],
  });

  readonly communicationCampaignsTotal = new Counter({
    name: "wapp_communication_campaigns_total",
    help: "Campaign lifecycle events",
    labelNames: ["status"] as const,
    registers: [this.registry],
  });

  readonly communicationBroadcastsTotal = new Counter({
    name: "wapp_communication_broadcasts_total",
    help: "Broadcast lifecycle events",
    labelNames: ["status"] as const,
    registers: [this.registry],
  });

  // ---- CRM (§4.3 "CRM") ----
  readonly crmLeadConversionsTotal = new Counter({
    name: "wapp_crm_lead_conversions_total",
    help: "Leads converted to customers",
    registers: [this.registry],
  });

  readonly crmDealsCreatedTotal = new Counter({
    name: "wapp_crm_deals_created_total",
    help: "Deals created",
    registers: [this.registry],
  });

  // ---- Billing (§4.3 "Billing") ----
  readonly billingPaymentsTotal = new Counter({
    name: "wapp_billing_payments_total",
    help: "Payment records created",
    labelNames: ["outcome"] as const, // "PAID" | "FAILED"
    registers: [this.registry],
  });

  readonly billingRefundsTotal = new Counter({
    name: "wapp_billing_refunds_total",
    help: "Refunds issued",
    registers: [this.registry],
  });

  readonly billingSubscriptionChangesTotal = new Counter({
    name: "wapp_billing_subscription_changes_total",
    help: "Subscription lifecycle changes",
    labelNames: ["type"] as const, // "upgrade" | "downgrade" | "cancel"
    registers: [this.registry],
  });

  // ---- Settings (§4.3 "Settings") ----
  readonly settingsApiKeysTotal = new Counter({
    name: "wapp_settings_api_keys_total",
    help: "API key lifecycle events",
    labelNames: ["action"] as const, // "created" | "revoked"
    registers: [this.registry],
  });

  readonly settingsWebhooksTotal = new Counter({
    name: "wapp_settings_webhooks_total",
    help: "Webhook config lifecycle events",
    labelNames: ["action"] as const, // "created" | "updated" | "deleted"
    registers: [this.registry],
  });

  readonly settingsIntegrationsTotal = new Counter({
    name: "wapp_settings_integrations_total",
    help: "Third-party integration lifecycle events",
    labelNames: ["action"] as const, // "connected" | "disconnected"
    registers: [this.registry],
  });

  // ---- Platform (§4.3 "Platform") ----
  readonly platformBreakGlassTotal = new Counter({
    name: "wapp_platform_break_glass_total",
    help: "Break-Glass support session lifecycle events",
    labelNames: ["action"] as const, // "requested" | "approved"
    registers: [this.registry],
  });

  readonly platformLoginTotal = new Counter({
    name: "wapp_platform_login_total",
    help: "Platform Administration login attempts",
    labelNames: ["outcome"] as const, // "success" | "failure"
    registers: [this.registry],
  });

  readonly platformWorkspaceSuspensionTotal = new Counter({
    name: "wapp_platform_workspace_suspension_total",
    help: "Workspace suspension/reactivation events",
    labelNames: ["action"] as const, // "suspended" | "reactivated"
    registers: [this.registry],
  });

  // ---- Infrastructure (§4.3 "Infrastructure": Redis, MongoDB — CPU/Memory/
  // Event Loop come free from collectDefaultMetrics() below) ----
  readonly infraDependencyUp = new Gauge({
    name: "wapp_infra_dependency_up",
    help: "1 if the dependency's last health check succeeded, else 0",
    labelNames: ["dependency"] as const, // "mongodb" | "redis"
    registers: [this.registry],
  });

  // ---- Background Job Observability (§4.12 — feeds this same registry so
  // queue metrics are visible on the same /metrics surface as everything
  // else, rather than a separate endpoint) ----
  readonly queueJobDurationSeconds = new Histogram({
    name: "wapp_queue_job_duration_seconds",
    help: "BullMQ job execution duration in seconds",
    labelNames: ["queue"] as const,
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
    registers: [this.registry],
  });

  readonly queueJobRetriesTotal = new Counter({
    name: "wapp_queue_job_retries_total",
    help: "BullMQ job retry attempts",
    labelNames: ["queue"] as const,
    registers: [this.registry],
  });

  readonly queueJobFailedPermanentlyTotal = new Counter({
    name: "wapp_queue_job_failed_permanently_total",
    help: "BullMQ jobs that exhausted all retry attempts",
    labelNames: ["queue"] as const,
    registers: [this.registry],
  });

  // ---- Security Event Logging (§4.11 — counters alongside the durable
  // audit-log writes, so rate/spike detection doesn't require querying Mongo) ----
  readonly securityPermissionDeniedTotal = new Counter({
    name: "wapp_security_permission_denied_total",
    help: "Authorization/permission denials",
    labelNames: ["actor"] as const, // "tenant" | "platform"
    registers: [this.registry],
  });

  readonly securityWebhookSignatureFailureTotal = new Counter({
    name: "wapp_security_webhook_signature_failure_total",
    help: "Inbound webhook signature validation failures",
    registers: [this.registry],
  });

  readonly securityRateLimitViolationTotal = new Counter({
    name: "wapp_security_rate_limit_violation_total",
    help: "Requests rejected by the rate limiter (HTTP 429)",
    labelNames: ["route"] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry, prefix: "wapp_" });
  }
}
