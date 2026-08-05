import type { MessageDirection, MessageStatus, MessageType } from "./schemas/message.schema.js";
import type { ConversationStatus } from "./schemas/conversation.schema.js";
import type { QualityRating } from "./schemas/phone-number.schema.js";
import type { WhatsAppConnectionStatus } from "./schemas/whatsapp-connection.schema.js";
import type {
  TemplateCategory,
  TemplateComponent,
  TemplateStatus,
} from "./schemas/template.schema.js";

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
  conversationId: string;
  contactId: string;
  direction: MessageDirection;
  type: MessageType;
  text: string | null;
  status: MessageStatus;
  occurredAt: string;
}

export interface ConversationSummary {
  id: string;
  contactId: string;
  contactPhoneNumber: string | null;
  contactName: string | null;
  phoneNumberId: string;
  status: ConversationStatus;
  assignedToUserId: string | null;
  lastMessageAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface ConversationNoteSummary {
  id: string;
  conversationId: string;
  authorUserId: string;
  text: string;
  createdAt: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponent[];
  status: TemplateStatus;
  metaTemplateId: string | null;
  rejectionReason: string | null;
  createdAt: string;
}
