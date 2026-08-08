/**
 * Domain event catalog — the publish side of a publish/subscribe boundary
 * between business modules and cross-cutting concerns (Global Audit,
 * Notifications) that don't exist yet (SDP-001 module order — Audit and
 * Notification are later modules). Publishing now, with no listener but the
 * temporary logger (see domain-event-logger.listener.ts), means those
 * future modules subscribe without any change to the code that emits these
 * events — the publisher never needs to know who's listening.
 *
 * Event names are dot-namespaced ("workspace.created") so a future listener
 * can subscribe to a wildcard ("workspace.*", "team.*") instead of every
 * event individually (EventEmitterModule is configured with
 * `wildcard: true` for exactly this).
 */
export const DomainEvent = {
  WORKSPACE_CREATED: "workspace.created",
  WORKSPACE_UPDATED: "workspace.updated",
  TEAM_MEMBER_INVITED: "team.member_invited",
  TEAM_MEMBER_ACCEPTED: "team.member_accepted",
  TEAM_MEMBER_SUSPENDED: "team.member_suspended",
  TEAM_MEMBER_REACTIVATED: "team.member_reactivated",
  TEAM_OWNERSHIP_TRANSFERRED: "team.ownership_transferred",
  WHATSAPP_CONNECTED: "communication.whatsapp_connected",
  MESSAGE_RECEIVED: "communication.message_received",
  MESSAGE_SENT: "communication.message_sent",
  CONVERSATION_ASSIGNED: "communication.conversation_assigned",
  CONVERSATION_STATUS_CHANGED: "communication.conversation_status_changed",
  CONVERSATION_NOTE_ADDED: "communication.conversation_note_added",
  TEMPLATE_SUBMITTED: "communication.template_submitted",
  TEMPLATE_STATUS_CHANGED: "communication.template_status_changed",
  BROADCAST_STARTED: "communication.broadcast_started",
  BROADCAST_COMPLETED: "communication.broadcast_completed",
  // Fires on every terminal transition (COMPLETED/FAILED/CANCELLED), unlike
  // BROADCAST_COMPLETED which only fires on successful completion — this is
  // CampaignService's own completion-detection signal (see
  // docs/COMM-CAMPAIGN-LIFECYCLE.md), not a general-purpose audit event.
  BROADCAST_FINISHED: "communication.broadcast_finished",
  CAMPAIGN_COMPLETED: "communication.campaign_completed",
  CAMPAIGN_CANCELLED: "communication.campaign_cancelled",
  // Part 4c (SLA Monitoring + Escalation Rules) — fires once per escalation
  // sweep hit, in addition to (not instead of) CONVERSATION_ASSIGNED when a
  // Manager was actually reassigned (see docs/COMM-SLA-ESCALATION.md and
  // ADR-COMM-013's payload-gap discussion). CONVERSATION_ASSIGNED alone
  // doesn't say *why* an assignment happened; this event is that "why" for
  // the SLA-breach case specifically.
  CONVERSATION_SLA_BREACHED: "communication.conversation_sla_breached",
  // Phase-5 Part-1 (Customer Management, PRD-004 Volume-1 §16/BR-008/009/010).
  CUSTOMER_CREATED: "crm.customer_created",
  CUSTOMER_UPDATED: "crm.customer_updated",
  CUSTOMER_BLOCKED: "crm.customer_blocked",
  CUSTOMER_ACTIVATED: "crm.customer_activated",
  CUSTOMER_ARCHIVED: "crm.customer_archived",
  // Phase-5 Part-2 (Lead Management, PRD-004 Volume-2 §17/BR-010). Every
  // status transition emits an event: the three named "milestone" targets
  // (QUALIFIED/WON/LOST) get their own dedicated event; every other target
  // (CONTACTED/PROPOSAL_SENT/NEGOTIATION/UNQUALIFIED) emits the generic
  // LEAD_STATUS_CHANGED fallback — same dual-event shape ADR-COMM-013
  // already established for CONVERSATION_ASSIGNED vs CONVERSATION_SLA_BREACHED.
  // See docs/ADR-CRM-005-lead-qualification-strategy.md.
  LEAD_CREATED: "crm.lead_created",
  LEAD_UPDATED: "crm.lead_updated",
  LEAD_ASSIGNED: "crm.lead_assigned",
  LEAD_UNASSIGNED: "crm.lead_unassigned",
  LEAD_QUALIFIED: "crm.lead_qualified",
  LEAD_WON: "crm.lead_won",
  LEAD_LOST: "crm.lead_lost",
  LEAD_STATUS_CHANGED: "crm.lead_status_changed",
  LEAD_ARCHIVED: "crm.lead_archived",
  // Phase-5 Part-3 (Lead Conversion, PRD-004 Volume-3 §12/BR-009). All
  // three fire only after the transaction commits — see
  // docs/ADR-CRM-009-lead-conversion-strategy.md. CUSTOMER_CREATED_FROM_LEAD
  // fires only when conversion actually created a new Customer (not when an
  // already-linked one was reused); note this is deliberately distinct from
  // the existing CUSTOMER_CREATED (Part-1) — a future listener needs to
  // know *why* a Customer was created, the same reasoning already applied
  // to CONVERSATION_SLA_BREACHED vs. CONVERSATION_ASSIGNED.
  LEAD_CONVERTED: "crm.lead_converted",
  DEAL_CREATED_FROM_LEAD: "crm.deal_created_from_lead",
  CUSTOMER_CREATED_FROM_LEAD: "crm.customer_created_from_lead",
  // Phase-5 Part-4 (Deal Management, PRD-004 Volume-4 §15/BR-010). No
  // generic DEAL_CREATED — DEAL_CREATED_FROM_LEAD (above) already covers
  // the only creation path (§3, ADR-CRM-010); a second, more generic event
  // for the same single path would be redundant. Stage changes follow the
  // same dual-event shape as Lead's status changes: DEAL_WON/DEAL_LOST are
  // the named milestones, DEAL_STAGE_CHANGED is the generic fallback for
  // QUALIFICATION/PROPOSAL/NEGOTIATION — see
  // docs/ADR-CRM-012-deal-lifecycle-strategy.md.
  DEAL_UPDATED: "crm.deal_updated",
  DEAL_ASSIGNED: "crm.deal_assigned",
  DEAL_UNASSIGNED: "crm.deal_unassigned",
  DEAL_STAGE_CHANGED: "crm.deal_stage_changed",
  DEAL_WON: "crm.deal_won",
  DEAL_LOST: "crm.deal_lost",
  DEAL_REOPENED: "crm.deal_reopened",
  // Phase-5 Part-5 (Activities, Tasks, Follow-ups & Notes, PRD-004
  // Volume-5 §16). Creation dispatches by type: NOTE_ADDED and
  // FOLLOW_UP_SCHEDULED are the named milestones, ACTIVITY_CREATED is the
  // generic fallback (Task/Call/Meeting/Email/Reminder) — same dual-event
  // shape as Lead/Deal. No REMINDER_TRIGGERED yet: resolved 2026-08-07,
  // nothing in this Part detects a due reminder (no Notification module to
  // fire into), so declaring an event with zero emitters would be dead
  // code — see docs/ADR-CRM-015-activity-timeline-strategy.md. No
  // ACTIVITY_ARCHIVED in §16 either, but added here anyway for consistency
  // with every other soft-delete-capable CRM entity (Customer, Lead) —
  // BR-006 needs a corresponding audit event the same way its archive
  // endpoint needed to exist at all.
  ACTIVITY_CREATED: "crm.activity_created",
  ACTIVITY_UPDATED: "crm.activity_updated",
  ACTIVITY_ARCHIVED: "crm.activity_archived",
  TASK_ASSIGNED: "crm.task_assigned",
  TASK_UNASSIGNED: "crm.task_unassigned",
  TASK_COMPLETED: "crm.task_completed",
  FOLLOW_UP_SCHEDULED: "crm.follow_up_scheduled",
  FOLLOW_UP_ASSIGNED: "crm.follow_up_assigned",
  FOLLOW_UP_UNASSIGNED: "crm.follow_up_unassigned",
  FOLLOW_UP_COMPLETED: "crm.follow_up_completed",
  NOTE_ADDED: "crm.note_added",
  // Phase-6 Part-1 (Subscription & Plans, PRD-005 Volume-1 §14/BR-006).
  // SUBSCRIPTION_ACTIVATED fires only on the TRIAL/GRACE_PERIOD/SUSPENDED
  // -> ACTIVE transition (a real reactivation), not on every update.
  // GRACE_PERIOD_STARTED covers both trial-expiry-into-grace and paid-
  // period-lapse-into-grace (§4's linear diagram is the maximal path, not a
  // mandatory one through every state — same reasoning already applied to
  // Lead's LOST/UNQUALIFIED and Deal's LOST reachability) — see
  // docs/ADR-BILL-002-workspace-billing-synchronization.md.
  SUBSCRIPTION_CREATED: "billing.subscription_created",
  TRIAL_STARTED: "billing.trial_started",
  TRIAL_EXPIRED: "billing.trial_expired",
  SUBSCRIPTION_ACTIVATED: "billing.subscription_activated",
  SUBSCRIPTION_UPGRADED: "billing.subscription_upgraded",
  SUBSCRIPTION_DOWNGRADED: "billing.subscription_downgraded",
  SUBSCRIPTION_CANCELLED: "billing.subscription_cancelled",
  GRACE_PERIOD_STARTED: "billing.grace_period_started",
  SUBSCRIPTION_SUSPENDED: "billing.subscription_suspended",
  // Phase-6 Part-2 (Invoices & Payments, PRD-005 Volume-2 §10). PAYMENT_PAID
  // (not PAYMENT_SUCCESSFUL, §10's literal wording) mirrors this catalog's
  // existing convention of naming events after the resulting status
  // (CUSTOMER_BLOCKED/CUSTOMER_ACTIVATED, INVOICE_PAID itself) — consistent
  // with the Architecture Review's resolution to use PaymentStatus.PAID
  // (ADR-039) rather than "Success" for the status value itself. Every
  // Payment is created PENDING first and resolved synchronously in the same
  // call (PAYMENT_INITIATED always fires, immediately followed by
  // PAYMENT_PAID or PAYMENT_FAILED) — there is no async gateway callback yet
  // (Payment Gateway Integration is §14 Out of Scope), so "initiated" and
  // "resolved" happen back-to-back rather than being genuinely
  // time-separated. BILLING_HISTORY_RECORDED fires once per
  // BillingHistoryEntry written (§10's own literal 8th event) — see
  // docs/ADR-BILL-005-billing-event-strategy.md.
  INVOICE_GENERATED: "billing.invoice_generated",
  INVOICE_PAID: "billing.invoice_paid",
  INVOICE_OVERDUE: "billing.invoice_overdue",
  PAYMENT_INITIATED: "billing.payment_initiated",
  PAYMENT_PAID: "billing.payment_paid",
  PAYMENT_FAILED: "billing.payment_failed",
  PAYMENT_REFUNDED: "billing.payment_refunded",
  BILLING_HISTORY_RECORDED: "billing.billing_history_recorded",
  // Phase-6 Part-3 (Usage, Limits & Enforcement, PRD-005 Volume-3 §12).
  // Deliberately dormant in practice today: every seeded Plan's limits are
  // null pending commercial approval (TD-014), so no counter can ever cross
  // a threshold or exceed a limit yet — these events exist and are wired
  // correctly, they simply have nothing to fire on until real limits are
  // approved. WORKSPACE_LOCKED/UNLOCKED are per-counter, never
  // WorkspaceStatus — resolved 2026-08-07, Architecture Review: "locked"
  // means new-resource-creation blocked for one over-limit resource type,
  // not a workspace-wide state, and never touches the canonical
  // WorkspaceStatus enum (BR-002). See
  // docs/ADR-BILL-008-commercial-enforcement-strategy.md.
  USAGE_THRESHOLD_REACHED: "billing.usage_threshold_reached",
  USAGE_LIMIT_EXCEEDED: "billing.usage_limit_exceeded",
  FEATURE_ENABLED: "billing.feature_enabled",
  FEATURE_DISABLED: "billing.feature_disabled",
  WORKSPACE_LOCKED: "billing.workspace_locked",
  WORKSPACE_UNLOCKED: "billing.workspace_unlocked",
  // Phase-7 Part-1 (Workspace Settings, PRD-006 Volume-1). Fires only for
  // Settings-owned data (branding, preferences) — Workspace's own
  // Business Profile/Business Hours/Notification Settings keep emitting
  // WORKSPACE_UPDATED unchanged, since Settings orchestrates that data
  // rather than owning it (docs/ADR-SET-001-settings-ownership-strategy.md).
  SETTINGS_UPDATED: "settings.updated",
  // Phase-7 Part-2 (User Preferences & Security Settings, PRD-006 Volume-2
  // §7). Personal-scope events, distinct from SETTINGS_UPDATED (workspace
  // -scope, Volume-1) — resolved 2026-08-07, Architecture Review: Settings
  // does NOT consume Identity's own events (PASSWORD_CHANGED/
  // SESSION_REVOKED/LOGIN_SUCCESS/LOGIN_FAILED were never added — Settings
  // orchestrates Identity via direct service calls, not event projection).
  // These three are named individually per §7's own literal event names,
  // not folded into one generic event with a section field.
  USER_PREFERENCES_UPDATED: "settings.user_preferences_updated",
  THEME_CHANGED: "settings.theme_changed",
  NOTIFICATION_PREFERENCES_UPDATED: "settings.notification_preferences_updated",
  // Phase-7 Part-3 (Integrations & External Services, PRD-006 Volume-3 §8).
  // Workspace-scope, like SETTINGS_UPDATED — `integrationType` distinguishes
  // which integration changed rather than adding a new event per type,
  // matching Volume-1's `section` field convention on SETTINGS_UPDATED.
  INTEGRATION_CONNECTED: "settings.integration_connected",
  INTEGRATION_DISCONNECTED: "settings.integration_disconnected",
  WEBHOOK_CREATED: "settings.webhook_created",
  WEBHOOK_UPDATED: "settings.webhook_updated",
  API_KEY_CREATED: "settings.api_key_created",
  API_KEY_REVOKED: "settings.api_key_revoked",
  // Phase-7 Part-4 (Audit Logs, Data Management & System Administration,
  // PRD-006 Volume-4 §8). Audit Logs (§4.1) and Configuration History (§4.2)
  // are deliberately NOT new emitters here — they consume the existing
  // catalog above (WORKSPACE_UPDATED, SETTINGS_UPDATED, WEBHOOK_CREATED/
  // UPDATED, etc.) rather than adding parallel events for data that's
  // already published, per §8's own "no duplicate persistence" rule.
  FEATURE_FLAG_UPDATED: "settings.feature_flag_updated",
  MAINTENANCE_MODE_ENABLED: "settings.maintenance_mode_enabled",
  MAINTENANCE_MODE_DISABLED: "settings.maintenance_mode_disabled",
  RETENTION_POLICY_UPDATED: "settings.retention_policy_updated",
  SYSTEM_PREFERENCE_UPDATED: "settings.system_preference_updated",
} as const;

interface BaseEventPayload {
  workspaceId: string;
  occurredAt: string;
}

export interface WorkspaceCreatedPayload extends BaseEventPayload {
  ownerId: string;
  name: string;
}

export interface WorkspaceUpdatedPayload extends BaseEventPayload {
  section: "business_profile" | "business_hours" | "notification_settings";
  updatedBy: string;
}

export interface TeamMemberInvitedPayload extends BaseEventPayload {
  email: string;
  role: string;
  invitedBy: string;
}

export interface TeamMemberAcceptedPayload extends BaseEventPayload {
  userId: string;
  role: string;
}

export interface TeamMemberSuspendedPayload extends BaseEventPayload {
  userId: string;
  actorId: string;
}

export interface TeamMemberReactivatedPayload extends BaseEventPayload {
  userId: string;
  actorId: string;
}

export interface TeamOwnershipTransferredPayload extends BaseEventPayload {
  previousOwnerId: string;
  newOwnerId: string;
}

export interface WhatsAppConnectedPayload extends BaseEventPayload {
  wabaId: string;
  connectedBy: string;
}

export interface MessageReceivedPayload extends BaseEventPayload {
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  waMessageId: string;
}

export interface MessageSentPayload extends BaseEventPayload {
  conversationId: string;
  contactId: string;
  phoneNumberId: string;
  waMessageId: string;
  sentBy: string;
}

export interface ConversationAssignedPayload extends BaseEventPayload {
  conversationId: string;
  contactId: string;
  assignedToUserId: string | null;
  actorId: string;
}

export interface ConversationStatusChangedPayload extends BaseEventPayload {
  conversationId: string;
  contactId: string;
  previousStatus: string;
  newStatus: string;
  /** "SYSTEM" for the auto-close sweep, otherwise the acting user's id. */
  actorId: string;
}

export interface ConversationNoteAddedPayload extends BaseEventPayload {
  conversationId: string;
  contactId: string;
  authorUserId: string;
}

export interface TemplateSubmittedPayload extends BaseEventPayload {
  templateId: string;
  metaTemplateId: string;
  submittedBy: string;
}

export interface TemplateStatusChangedPayload extends BaseEventPayload {
  templateId: string;
  previousStatus: string;
  newStatus: string;
}

export interface BroadcastStartedPayload extends BaseEventPayload {
  broadcastId: string;
  startedBy: string;
}

export interface BroadcastCompletedPayload extends BaseEventPayload {
  broadcastId: string;
  sentCount: number;
  failedCount: number;
}

export interface BroadcastFinishedPayload extends BaseEventPayload {
  broadcastId: string;
  campaignId: string | null;
  finalStatus: string;
}

export interface CampaignCompletedPayload extends BaseEventPayload {
  campaignId: string;
}

export interface CampaignCancelledPayload extends BaseEventPayload {
  campaignId: string;
  actorId: string;
}

export interface ConversationSlaBreachedPayload extends BaseEventPayload {
  conversationId: string;
  contactId: string;
  /** null when there was no eligible Manager to escalate to — the breach is still reported, just unassigned. */
  escalatedToUserId: string | null;
  previousAssignedToUserId: string | null;
  breachedSinceHours: number;
}

export interface CustomerCreatedPayload extends BaseEventPayload {
  customerId: string;
  contactId: string;
  source: string;
  createdBy: string;
}

export interface CustomerUpdatedPayload extends BaseEventPayload {
  customerId: string;
  updatedBy: string;
}

export interface CustomerStatusChangedPayload extends BaseEventPayload {
  customerId: string;
  previousStatus: string;
  newStatus: string;
  actorId: string;
}

export interface LeadCreatedPayload extends BaseEventPayload {
  leadId: string;
  contactId: string;
  customerId: string | null;
  source: string;
  createdBy: string;
}

export interface LeadUpdatedPayload extends BaseEventPayload {
  leadId: string;
  updatedBy: string;
}

export interface LeadAssignedPayload extends BaseEventPayload {
  leadId: string;
  /** null for LEAD_UNASSIGNED. */
  assignedUserId: string | null;
  actorId: string;
}

export interface LeadStatusChangedPayload extends BaseEventPayload {
  leadId: string;
  previousStatus: string;
  newStatus: string;
  actorId: string;
}

export interface LeadArchivedPayload extends BaseEventPayload {
  leadId: string;
  actorId: string;
}

export interface LeadConvertedPayload extends BaseEventPayload {
  leadId: string;
  customerId: string;
  dealId: string;
  convertedBy: string;
}

export interface DealCreatedFromLeadPayload extends BaseEventPayload {
  dealId: string;
  contactId: string;
  customerId: string;
  sourceLeadId: string;
  createdBy: string;
}

export interface CustomerCreatedFromLeadPayload extends BaseEventPayload {
  customerId: string;
  contactId: string;
  sourceLeadId: string;
  createdBy: string;
}

export interface DealUpdatedPayload extends BaseEventPayload {
  dealId: string;
  updatedBy: string;
}

export interface DealAssignedPayload extends BaseEventPayload {
  dealId: string;
  /** null for DEAL_UNASSIGNED. */
  assignedTo: string | null;
  actorId: string;
}

export interface DealStageChangedPayload extends BaseEventPayload {
  dealId: string;
  previousStage: string;
  newStage: string;
  actorId: string;
}

export interface DealReopenedPayload extends BaseEventPayload {
  dealId: string;
  actorId: string;
}

export interface ActivityCreatedPayload extends BaseEventPayload {
  activityId: string;
  type: string;
  customerId: string | null;
  dealId: string | null;
  createdBy: string;
}

export interface ActivityUpdatedPayload extends BaseEventPayload {
  activityId: string;
  updatedBy: string;
}

export interface ActivityArchivedPayload extends BaseEventPayload {
  activityId: string;
  actorId: string;
}

export interface TaskAssignedPayload extends BaseEventPayload {
  activityId: string;
  /** null for TASK_UNASSIGNED. */
  assignedUserId: string | null;
  actorId: string;
}

export interface TaskCompletedPayload extends BaseEventPayload {
  activityId: string;
  actorId: string;
}

export interface FollowUpAssignedPayload extends BaseEventPayload {
  activityId: string;
  /** null for FOLLOW_UP_UNASSIGNED. */
  assignedUserId: string | null;
  actorId: string;
}

export interface FollowUpCompletedPayload extends BaseEventPayload {
  activityId: string;
  actorId: string;
}

export interface SubscriptionCreatedPayload extends BaseEventPayload {
  subscriptionId: string;
  planId: string;
}

export interface TrialStartedPayload extends BaseEventPayload {
  subscriptionId: string;
  trialEndsAt: string;
}

export interface TrialExpiredPayload extends BaseEventPayload {
  subscriptionId: string;
}

export interface SubscriptionActivatedPayload extends BaseEventPayload {
  subscriptionId: string;
  planId: string;
}

export interface SubscriptionUpgradedPayload extends BaseEventPayload {
  subscriptionId: string;
  previousPlanId: string;
  newPlanId: string;
  actorId: string;
}

export interface SubscriptionDowngradedPayload extends BaseEventPayload {
  subscriptionId: string;
  previousPlanId: string;
  /** The downgrade is queued, not yet applied — see effectiveAt. */
  pendingPlanId: string;
  effectiveAt: string;
  actorId: string;
}

export interface SubscriptionCancelledPayload extends BaseEventPayload {
  subscriptionId: string;
  actorId: string;
}

export interface GracePeriodStartedPayload extends BaseEventPayload {
  subscriptionId: string;
  graceEndsAt: string;
}

export interface SubscriptionSuspendedPayload extends BaseEventPayload {
  subscriptionId: string;
}

export interface InvoiceGeneratedPayload extends BaseEventPayload {
  invoiceId: string;
  subscriptionId: string;
  invoiceNumber: string;
  /** Null when Plan pricing is not yet approved — see TD-009/TD-011. */
  amount: number | null;
}

export interface InvoicePaidPayload extends BaseEventPayload {
  invoiceId: string;
  paymentId: string;
}

export interface InvoiceOverduePayload extends BaseEventPayload {
  invoiceId: string;
  dueDate: string;
}

export interface PaymentInitiatedPayload extends BaseEventPayload {
  paymentId: string;
  invoiceId: string;
  gateway: string;
}

export interface PaymentPaidPayload extends BaseEventPayload {
  paymentId: string;
  invoiceId: string;
  amount: number;
}

export interface PaymentFailedPayload extends BaseEventPayload {
  paymentId: string;
  invoiceId: string;
}

export interface PaymentRefundedPayload extends BaseEventPayload {
  paymentId: string;
  invoiceId: string;
  actorId: string;
}

export interface BillingHistoryRecordedPayload extends BaseEventPayload {
  entryId: string;
  eventType: string;
}

export interface UsageThresholdReachedPayload extends BaseEventPayload {
  counterType: string;
  threshold: number;
  currentCount: number;
  limit: number;
}

export interface UsageLimitExceededPayload extends BaseEventPayload {
  counterType: string;
  currentCount: number;
  limit: number;
}

export interface FeatureEnabledPayload extends BaseEventPayload {
  feature: string;
}

export interface FeatureDisabledPayload extends BaseEventPayload {
  feature: string;
}

export interface WorkspaceLockedPayload extends BaseEventPayload {
  counterType: string;
}

export interface WorkspaceUnlockedPayload extends BaseEventPayload {
  counterType: string;
}

export interface SettingsUpdatedPayload extends BaseEventPayload {
  section: "branding" | "preferences";
  updatedBy: string;
}

/**
 * Personal-scope events (Volume-2) key by `userId`, not `workspaceId` —
 * `workspaceId` is still included since `BaseEventPayload` requires it
 * (every event in this catalog is workspace-scoped for isolation/routing
 * purposes) and a Phase-1 user has exactly one Workspace anyway.
 */
export interface UserPreferencesUpdatedPayload extends BaseEventPayload {
  userId: string;
  section: "preferences" | "dashboard";
}

export interface ThemeChangedPayload extends BaseEventPayload {
  userId: string;
}

export interface NotificationPreferencesUpdatedPayload extends BaseEventPayload {
  userId: string;
}

export type IntegrationType = "WHATSAPP" | "EMAIL" | "THIRD_PARTY_APP";

export interface IntegrationConnectedPayload extends BaseEventPayload {
  integrationType: IntegrationType;
  actorId: string;
}

export interface IntegrationDisconnectedPayload extends BaseEventPayload {
  integrationType: IntegrationType;
  actorId: string;
}

export interface WebhookCreatedPayload extends BaseEventPayload {
  webhookId: string;
  actorId: string;
}

export interface WebhookUpdatedPayload extends BaseEventPayload {
  webhookId: string;
  actorId: string;
}

export interface ApiKeyCreatedPayload extends BaseEventPayload {
  apiKeyId: string;
  actorId: string;
}

export interface ApiKeyRevokedPayload extends BaseEventPayload {
  apiKeyId: string;
  actorId: string;
}

export interface FeatureFlagUpdatedPayload extends BaseEventPayload {
  flagKey: string;
  enabled: boolean;
  actorId: string;
}

export interface MaintenanceModeEnabledPayload extends BaseEventPayload {
  actorId: string;
}

export interface MaintenanceModeDisabledPayload extends BaseEventPayload {
  actorId: string;
}

export interface RetentionPolicyUpdatedPayload extends BaseEventPayload {
  actorId: string;
}

export interface SystemPreferenceUpdatedPayload extends BaseEventPayload {
  actorId: string;
}
