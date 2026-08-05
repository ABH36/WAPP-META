import { Injectable } from "@nestjs/common";
import type { ConversationDocument } from "../schemas/conversation.schema.js";
import { OutsideCustomerServiceWindowException } from "../exceptions/compliance.exceptions.js";

const CUSTOMER_SERVICE_WINDOW_HOURS = 24;

/**
 * Meta Compliance Engine (PRD-003 Part 3 Module H, BDC-008) — enforces the
 * 24-hour customer service window against every outbound message, including
 * Part-2's 1:1 replies, per BDC-008's explicit confirmation this governs
 * *all* outgoing communication, not just broadcasts. See
 * docs/COMM-COMPLIANCE-ENGINE.md for the full rationale and what's still out
 * of scope (Broadcast-specific audience-consent checks, Part 3b).
 */
@Injectable()
export class ComplianceEngineService {
  /** `null` covers "no Conversation exists yet" (never received a customer message) — treated as outside the window, same as any other case with no customer activity to measure from. */
  isWithinCustomerServiceWindow(conversation: ConversationDocument | null): boolean {
    if (!conversation?.lastCustomerMessageAt) {
      return false;
    }
    const elapsedMs = Date.now() - conversation.lastCustomerMessageAt.getTime();
    return elapsedMs <= CUSTOMER_SERVICE_WINDOW_HOURS * 60 * 60 * 1000;
  }

  /** Free-text (non-template) sends are only permitted inside the window — throws otherwise. Template sends are exempt (that's what templates are for) and never call this. */
  assertFreeTextAllowed(conversation: ConversationDocument | null): void {
    if (!this.isWithinCustomerServiceWindow(conversation)) {
      throw new OutsideCustomerServiceWindowException();
    }
  }
}
