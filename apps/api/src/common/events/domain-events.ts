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
