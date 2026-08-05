import { ComplianceEngineService } from "./compliance-engine.service.js";
import { OutsideCustomerServiceWindowException } from "../exceptions/compliance.exceptions.js";
import type { ConversationDocument } from "../schemas/conversation.schema.js";

function conversationWithLastCustomerMessageAt(hoursAgo: number | null): ConversationDocument {
  return {
    lastCustomerMessageAt:
      hoursAgo === null ? null : new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
  } as ConversationDocument;
}

describe("ComplianceEngineService", () => {
  const service = new ComplianceEngineService();

  describe("isWithinCustomerServiceWindow", () => {
    it("is true just inside the 24h window", () => {
      expect(service.isWithinCustomerServiceWindow(conversationWithLastCustomerMessageAt(23))).toBe(
        true,
      );
    });

    it("is false just outside the 24h window", () => {
      expect(service.isWithinCustomerServiceWindow(conversationWithLastCustomerMessageAt(25))).toBe(
        false,
      );
    });

    it("is false when the conversation has never had a customer message", () => {
      expect(
        service.isWithinCustomerServiceWindow(conversationWithLastCustomerMessageAt(null)),
      ).toBe(false);
    });

    it("is false when no Conversation exists at all", () => {
      expect(service.isWithinCustomerServiceWindow(null)).toBe(false);
    });
  });

  describe("assertFreeTextAllowed", () => {
    it("does not throw inside the window", () => {
      expect(() =>
        service.assertFreeTextAllowed(conversationWithLastCustomerMessageAt(1)),
      ).not.toThrow();
    });

    it("throws OutsideCustomerServiceWindowException outside the window", () => {
      expect(() =>
        service.assertFreeTextAllowed(conversationWithLastCustomerMessageAt(48)),
      ).toThrow(OutsideCustomerServiceWindowException);
    });

    it("throws for a null Conversation", () => {
      expect(() => service.assertFreeTextAllowed(null)).toThrow(
        OutsideCustomerServiceWindowException,
      );
    });
  });
});
