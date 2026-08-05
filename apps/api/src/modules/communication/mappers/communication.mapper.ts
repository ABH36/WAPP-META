import type { WhatsAppConnectionDocument } from "../schemas/whatsapp-connection.schema.js";
import type { PhoneNumberDocument } from "../schemas/phone-number.schema.js";
import type { MessageDocument } from "../schemas/message.schema.js";
import type {
  ConnectionSummary,
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
    contactId: message.contactId.toString(),
    direction: message.direction,
    type: message.type,
    text: message.text,
    status: message.status,
    occurredAt: message.occurredAt.toISOString(),
  };
}
