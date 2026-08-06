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
