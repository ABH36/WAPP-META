"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, ChatBubble, ContactCard, Select, SkeletonText, Textarea } from "@wapp/ui";
import { conversationService } from "../../services/conversation.service";
import { teamService } from "../../services/team.service";
import { useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import { MessageComposer } from "./message-composer";
import type { ConversationStatus } from "../../types/conversation";

const STATUS_OPTIONS: ConversationStatus[] = [
  "OPEN",
  "ASSIGNED",
  "PENDING",
  "RESOLVED",
  "CLOSED",
  "SPAM",
  "ARCHIVED",
];

const POLL_INTERVAL_MS = 15_000;

interface ConversationViewProps {
  conversationId: string;
}

/**
 * FRD-001 Volume-4 §4.3 — Header/Timeline/Notes, polling-only (no push
 * mechanism exists). `GET :id` does not populate `contactName`/
 * `contactPhoneNumber` (a real backend discrepancy, not a frontend bug —
 * see docs/TECH-DEBT.md) — `ContactCard` shows its own "Unknown contact"
 * fallback rather than a client-side workaround. `NEW` is excluded from
 * the status dropdown (system-only, a manual PATCH to `NEW` is rejected
 * server-side). Assign is gated `ASSIGN_CONVERSATIONS`, stricter than the
 * `REPLY_CONVERSATIONS` gate that unlocks this screen at all — every
 * query (including notes, gated `ADD_INTERNAL_NOTES` server-side, which
 * has the identical role-grant pattern as `REPLY_CONVERSATIONS`) is
 * disabled and an access-restricted message shown for
 * `MARKETING_EXECUTIVE`, the one role with zero Inbox access.
 */
export function ConversationView({ conversationId }: ConversationViewProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.REPLY_CONVERSATIONS);
  const canAssign = useHasPermission(Permission.ASSIGN_CONVERSATIONS);
  const [noteText, setNoteText] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);

  const conversationQuery = useQuery({
    queryKey: ["communication", "conversation", conversationId],
    queryFn: () => conversationService.getById(conversationId),
    refetchInterval: POLL_INTERVAL_MS,
    // PHD-001 Volume-3 §17 — makes explicit what was previously only the
    // TanStack Query v5 default: this poller stops while the tab is
    // unfocused, rather than continuing to hit the API in the background.
    refetchIntervalInBackground: false,
    enabled: canView,
  });

  const messagesQuery = useQuery({
    queryKey: ["communication", "conversation", conversationId, "messages"],
    queryFn: () => conversationService.listMessages(conversationId),
    refetchInterval: POLL_INTERVAL_MS,
    // PHD-001 Volume-3 §17 — makes explicit what was previously only the
    // TanStack Query v5 default: this poller stops while the tab is
    // unfocused, rather than continuing to hit the API in the background.
    refetchIntervalInBackground: false,
    enabled: canView,
  });

  const notesQuery = useQuery({
    queryKey: ["communication", "conversation", conversationId, "notes"],
    queryFn: () => conversationService.listNotes(conversationId),
    enabled: canView,
  });

  const membersQuery = useQuery({
    queryKey: ["team", "members"],
    queryFn: () => teamService.listMembers(),
    enabled: canAssign,
  });

  const invalidateConversation = () =>
    queryClient.invalidateQueries({ queryKey: ["communication", "conversation", conversationId] });

  const handleStatusChange = async (status: ConversationStatus) => {
    setActionError(null);
    try {
      await conversationService.updateStatus(conversationId, status);
      await invalidateConversation();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update status.");
    }
  };

  const handleAssign = async (userId: string) => {
    setActionError(null);
    try {
      await conversationService.assign(conversationId, userId || null);
      await invalidateConversation();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to assign conversation.");
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setActionError(null);
    try {
      await conversationService.addNote(conversationId, noteText.trim());
      setNoteText("");
      await queryClient.invalidateQueries({
        queryKey: ["communication", "conversation", conversationId, "notes"],
      });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to add note.");
    }
  };

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to the Shared Inbox.</Alert>;
  }

  if (conversationQuery.isLoading) {
    return <SkeletonText lines={8} />;
  }

  const conversation = conversationQuery.data;
  if (!conversation) {
    return <Alert variant="danger">Unable to load this conversation.</Alert>;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {actionError ? <Alert variant="danger">{actionError}</Alert> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContactCard
          name={conversation.contactName}
          phoneNumber={conversation.contactPhoneNumber}
        />
        <div className="flex items-center gap-2">
          <Select
            aria-label="Change status"
            value={STATUS_OPTIONS.includes(conversation.status) ? conversation.status : ""}
            onChange={(event) => void handleStatusChange(event.target.value as ConversationStatus)}
            className="w-40"
          >
            {!STATUS_OPTIONS.includes(conversation.status) ? (
              <option value="">{conversation.status}</option>
            ) : null}
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          {canAssign ? (
            <Select
              aria-label="Assign to"
              value={conversation.assignedToUserId ?? ""}
              onChange={(event) => void handleAssign(event.target.value)}
              className="w-40"
            >
              <option value="">Unassigned</option>
              {(membersQuery.data ?? []).map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        {messagesQuery.isLoading ? (
          <SkeletonText lines={4} />
        ) : (messagesQuery.data ?? []).length === 0 ? (
          <p className="text-body-sm text-neutral-500 dark:text-neutral-400">No messages yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(messagesQuery.data ?? []).map((message) => (
              <ChatBubble
                key={message.id}
                direction={message.direction}
                text={message.text}
                occurredAt={message.occurredAt}
                status={message.direction === "OUTBOUND" ? message.status : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <MessageComposer conversationId={conversationId} />

      <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <h3 className="text-h3 mb-2 text-neutral-900 dark:text-neutral-50">Internal notes</h3>
        <div className="mb-2 flex flex-col gap-2">
          {(notesQuery.data ?? []).map((note) => (
            <div
              key={note.id}
              className="text-body-sm rounded-md bg-neutral-50 p-2 dark:bg-neutral-900"
            >
              {note.text}
              <div className="text-caption mt-1 text-neutral-500 dark:text-neutral-400">
                {new Date(note.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            aria-label="Add an internal note"
            className="min-h-9 flex-1"
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Add a note (not visible to the customer)"
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => void handleAddNote()}>
            Add note
          </Button>
        </div>
      </div>
    </div>
  );
}
