import { nextStatusOnActivity } from "./conversation-state-machine.js";
import { ConversationStatus } from "./schemas/conversation.schema.js";
import { MessageDirection } from "./schemas/message.schema.js";

describe("nextStatusOnActivity", () => {
  it("reopens a CLOSED conversation to OPEN when unassigned", () => {
    expect(nextStatusOnActivity(ConversationStatus.CLOSED, false, MessageDirection.INBOUND)).toBe(
      ConversationStatus.OPEN,
    );
  });

  it("reopens a CLOSED conversation to ASSIGNED when it has an assignee", () => {
    expect(nextStatusOnActivity(ConversationStatus.CLOSED, true, MessageDirection.OUTBOUND)).toBe(
      ConversationStatus.ASSIGNED,
    );
  });

  it("reopens a RESOLVED conversation the same way as CLOSED", () => {
    expect(nextStatusOnActivity(ConversationStatus.RESOLVED, false, MessageDirection.INBOUND)).toBe(
      ConversationStatus.OPEN,
    );
  });

  it("moves a PENDING conversation back to OPEN/ASSIGNED on any new activity", () => {
    expect(nextStatusOnActivity(ConversationStatus.PENDING, false, MessageDirection.INBOUND)).toBe(
      ConversationStatus.OPEN,
    );
    expect(nextStatusOnActivity(ConversationStatus.PENDING, true, MessageDirection.OUTBOUND)).toBe(
      ConversationStatus.ASSIGNED,
    );
  });

  it("leaves NEW unchanged on an inbound message (nobody has engaged yet)", () => {
    expect(
      nextStatusOnActivity(ConversationStatus.NEW, false, MessageDirection.INBOUND),
    ).toBeNull();
  });

  it("promotes NEW to OPEN/ASSIGNED on the first outbound (agent) message", () => {
    expect(nextStatusOnActivity(ConversationStatus.NEW, false, MessageDirection.OUTBOUND)).toBe(
      ConversationStatus.OPEN,
    );
    expect(nextStatusOnActivity(ConversationStatus.NEW, true, MessageDirection.OUTBOUND)).toBe(
      ConversationStatus.ASSIGNED,
    );
  });

  it("never auto-reopens SPAM or ARCHIVED", () => {
    expect(
      nextStatusOnActivity(ConversationStatus.SPAM, false, MessageDirection.INBOUND),
    ).toBeNull();
    expect(
      nextStatusOnActivity(ConversationStatus.ARCHIVED, true, MessageDirection.OUTBOUND),
    ).toBeNull();
  });

  it("leaves OPEN and ASSIGNED unchanged on further activity", () => {
    expect(
      nextStatusOnActivity(ConversationStatus.OPEN, false, MessageDirection.INBOUND),
    ).toBeNull();
    expect(
      nextStatusOnActivity(ConversationStatus.ASSIGNED, true, MessageDirection.OUTBOUND),
    ).toBeNull();
  });
});
