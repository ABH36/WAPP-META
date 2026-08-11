import { useQuery } from "@tanstack/react-query";
import { conversationService } from "../../services/conversation.service";

export interface KnownContact {
  id: string;
  label: string;
}

/**
 * FRD-001 Volume-4 §4.6 — Create Broadcast/Campaign both need a
 * `targetContactIds` picker, but there is no Contacts list/search
 * endpoint anywhere in the backend (confirmed during Architecture
 * Review). The only place a contact's id is jointly known with a
 * human-readable name/phone is via the Conversation list
 * (`ConversationSummary.contactId`/`contactName`/`contactPhoneNumber`).
 * This hook surfaces the up-to-100 most recently active conversations'
 * distinct contacts as the picker's only source — a deliberate,
 * documented limitation (recently-active contacts only, not a full
 * audience list), not an oversight. See docs/TECH-DEBT.md.
 */
export function useKnownContacts(): { contacts: KnownContact[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: ["communication", "known-contacts"],
    queryFn: () => conversationService.list({ page: 1, limit: 100 }),
  });

  const seen = new Set<string>();
  const contacts: KnownContact[] = [];
  for (const conversation of query.data?.items ?? []) {
    if (seen.has(conversation.contactId)) continue;
    seen.add(conversation.contactId);
    contacts.push({
      id: conversation.contactId,
      label: conversation.contactName ?? conversation.contactPhoneNumber ?? conversation.contactId,
    });
  }

  return { contacts, isLoading: query.isLoading };
}
