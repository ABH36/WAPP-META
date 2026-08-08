/**
 * PRD-006 Volume-3 §4.3 — the fixed set of business events a Workspace may
 * subscribe an outbound Webhook to. Maps 1:1 to an existing DomainEvent
 * constant in the API (never a new domain event of its own) — see
 * docs/ADR-SET-006-webhook-delivery-strategy.md.
 */
export enum WebhookEventType {
  CUSTOMER_CREATED = "CUSTOMER_CREATED",
  LEAD_CREATED = "LEAD_CREATED",
  DEAL_WON = "DEAL_WON",
  MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
  CAMPAIGN_COMPLETED = "CAMPAIGN_COMPLETED",
  INVOICE_PAID = "INVOICE_PAID",
}
