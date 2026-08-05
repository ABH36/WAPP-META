import type { Types } from "mongoose";
import type { WhatsAppConnectionDocument } from "../schemas/whatsapp-connection.schema.js";
import type { PhoneNumberDocument } from "../schemas/phone-number.schema.js";
import type { MessageDocument } from "../schemas/message.schema.js";
import type { ContactDocument } from "../schemas/contact.schema.js";
import type { ConversationDocument } from "../schemas/conversation.schema.js";
import type { ConversationNoteDocument } from "../schemas/conversation-note.schema.js";
import type {
  ConnectionSummary,
  ConversationNoteSummary,
  ConversationSummary,
  MessageSummary,
  PhoneNumberSummary,
} from "../communication.types.js";

export function toConnectionSummary(connection: WhatsAppConnectionDocument): ConnectionSummary {
  return {
    id: connection._id.toString(),
    wabaId: connection.wabaId,
    businessName: connection.businessName,
    status: connection.status,
    connectedAt: connection.createdAt.toISOString(),
  };
}

export function toPhoneNumberSummary(phoneNumber: PhoneNumberDocument): PhoneNumberSummary {
  return {
    id: phoneNumber._id.toString(),
    phoneNumberId: phoneNumber.phoneNumberId,
    displayPhoneNumber: phoneNumber.displayPhoneNumber,
    verifiedName: phoneNumber.verifiedName,
    qualityRating: phoneNumber.qualityRating,
    messagingLimitTier: phoneNumber.messagingLimitTier,
  };
}

export function toMessageSummary(message: MessageDocument): MessageSummary {
  return {
    id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    contactId: message.contactId.toString(),
    direction: message.direction,
    type: message.type,
    text: message.text,
    status: message.status,
    occurredAt: message.occurredAt.toISOString(),
  };
}

/** Distinguishes a Mongoose-populated ref from a bare ObjectId at runtime. */
function isPopulatedContact(value: Types.ObjectId | ContactDocument): value is ContactDocument {
  return typeof value === "object" && "phoneNumber" in value;
}

export function toConversationSummary(conversation: ConversationDocument): ConversationSummary {
  const contactRef = conversation.contactId as unknown as Types.ObjectId | ContactDocument;
  const populated = isPopulatedContact(contactRef);

  return {
    id: conversation._id.toString(),
    contactId: populated ? contactRef._id.toString() : contactRef.toString(),
    contactPhoneNumber: populated ? contactRef.phoneNumber : null,
    contactName: populated ? contactRef.waProfileName : null,
    phoneNumberId: conversation.phoneNumberId.toString(),
    status: conversation.status,
    assignedToUserId: conversation.assignedToUserId,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    resolvedAt: conversation.resolvedAt ? conversation.resolvedAt.toISOString() : null,
    closedAt: conversation.closedAt ? conversation.closedAt.toISOString() : null,
    createdAt: conversation.createdAt.toISOString(),
  };
}

export function toConversationNoteSummary(note: ConversationNoteDocument): ConversationNoteSummary {
  return {
    id: note._id.toString(),
    conversationId: note.conversationId.toString(),
    authorUserId: note.authorUserId,
    text: note.text,
    createdAt: note.createdAt.toISOString(),
  };
}
