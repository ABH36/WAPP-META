import { MetricsService } from "./metrics.service.js";

const EXPECTED_METRIC_NAMES = [
  "wapp_http_requests_total",
  "wapp_http_request_duration_seconds",
  "wapp_auth_login_success_total",
  "wapp_auth_login_failure_total",
  "wapp_auth_token_refresh_total",
  "wapp_auth_session_revocation_total",
  "wapp_communication_messages_total",
  "wapp_communication_campaigns_total",
  "wapp_communication_broadcasts_total",
  "wapp_crm_lead_conversions_total",
  "wapp_crm_deals_created_total",
  "wapp_billing_payments_total",
  "wapp_billing_refunds_total",
  "wapp_billing_subscription_changes_total",
  "wapp_settings_api_keys_total",
  "wapp_settings_webhooks_total",
  "wapp_settings_integrations_total",
  "wapp_platform_break_glass_total",
  "wapp_platform_login_total",
  "wapp_platform_workspace_suspension_total",
  "wapp_infra_dependency_up",
  "wapp_queue_job_duration_seconds",
  "wapp_queue_job_retries_total",
  "wapp_queue_job_failed_permanently_total",
  "wapp_security_permission_denied_total",
  "wapp_security_webhook_signature_failure_total",
  "wapp_security_rate_limit_violation_total",
];

describe("MetricsService", () => {
  it("registers every named metric from the PHD-001 Volume-2 planning document exactly once", async () => {
    const service = new MetricsService();

    for (const name of EXPECTED_METRIC_NAMES) {
      expect(service.registry.getSingleMetric(name)).toBeDefined();
    }

    const exposition = await service.registry.metrics();
    for (const name of EXPECTED_METRIC_NAMES) {
      expect(exposition).toContain(`# TYPE ${name} `);
    }
  });

  it("collects default Node process metrics under the wapp_ prefix", async () => {
    const service = new MetricsService();

    const exposition = await service.registry.metrics();

    expect(exposition).toMatch(/wapp_process_cpu_user_seconds_total|wapp_nodejs_/);
  });

  it("never labels any metric by workspaceId (cardinality discipline)", () => {
    const service = new MetricsService();

    for (const metric of service.registry.getMetricsAsArray()) {
      const labelNames = (metric as unknown as { labelNames?: string[] }).labelNames ?? [];
      expect(labelNames).not.toContain("workspaceId");
    }
  });

  it("each MetricsService instance owns an independent registry (no cross-test double-registration)", () => {
    const first = new MetricsService();
    const second = new MetricsService();

    first.httpRequestsTotal.inc({ method: "GET", route: "/x", status: "200" });

    expect(second.httpRequestsTotal).not.toBe(first.httpRequestsTotal);
  });
});
