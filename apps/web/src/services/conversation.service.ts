import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { Paginated } from "../types/pagination";
import type {
  ConversationNoteSummary,
  ConversationStatus,
  ConversationSummary,
  MessageSummary,
} from "../types/conversation";

interface ListConversationsParams {
  status?: ConversationStatus;
  assignedToUserId?: string;
  page?: number;
  limit?: number;
}

/**
 * FRD-001 Volume-4 §4.2/§4.3/§4.4 — Conversations/Messages/Notes, all
 * gated `REPLY_CONVERSATIONS` (the base "has Shared Inbox access" gate —
 * there is no separate `VIEW_CONVERSATIONS` permission) except `assign`
 * (`ASSIGN_CONVERSATIONS`, stricter) and the two note routes
 * (`ADD_INTERNAL_NOTES`). Only `status`/`assignedToUserId` filters exist
 * server-side (ADR-COMM-004) — no text/date search. `getById` does NOT
 * populate `contactName`/`contactPhoneNumber` (list does) — callers should
 * prefer the list's cached data for contact display where available.
 */
export const conversationService = {
  list(params: ListConversationsParams): Promise<Paginated<ConversationSummary>> {
    return apiGet("/communication/conversations", params as Record<string, unknown>);
  },

  getById(id: string): Promise<ConversationSummary> {
    return apiGet(`/communication/conversations/${id}`);
  },

  listMessages(id: string, limit?: number): Promise<MessageSummary[]> {
    return apiGet(`/communication/conversations/${id}/messages`, limit ? { limit } : undefined);
  },

  reply(id: string, text: string): Promise<MessageSummary> {
    return apiPost(`/communication/conversations/${id}/messages`, { text });
  },

  replyWithTemplate(
    id: string,
    templateId: string,
    bodyParameters: string[],
  ): Promise<MessageSummary> {
    return apiPost(`/communication/conversations/${id}/template-messages`, {
      templateId,
      bodyParameters,
    });
  },

  updateStatus(id: string, status: ConversationStatus): Promise<ConversationSummary> {
    return apiPatch(`/communication/conversations/${id}/status`, { status });
  },

  assign(id: string, assignedToUserId: string | null): Promise<ConversationSummary> {
    return apiPatch(`/communication/conversations/${id}/assign`, { assignedToUserId });
  },

  addNote(id: string, text: string): Promise<ConversationNoteSummary> {
    return apiPost(`/communication/conversations/${id}/notes`, { text });
  },

  listNotes(id: string): Promise<ConversationNoteSummary[]> {
    return apiGet(`/communication/conversations/${id}/notes`);
  },
};
