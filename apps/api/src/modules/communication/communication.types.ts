import type { MessageDirection, MessageStatus, MessageType } from "./schemas/message.schema.js";
import type { QualityRating } from "./schemas/phone-number.schema.js";
import type { WhatsAppConnectionStatus } from "./schemas/whatsapp-connection.schema.js";

export interface ConnectionSummary {
  id: string;
  wabaId: string;
  businessName: string | null;
  status: WhatsAppConnectionStatus;
  connectedAt: string;
}

export interface PhoneNumberSummary {
  id: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string | null;
  qualityRating: QualityRating;
  messagingLimitTier: string | null;
}

export interface MessageSummary {
  id: string;
  contactId: string;
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  status: MessageStatus;
  occurredAt: string;
}
