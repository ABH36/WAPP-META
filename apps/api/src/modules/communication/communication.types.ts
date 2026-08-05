import type { MessageDirection, MessageStatus, MessageType } from "./schemas/message.schema.js";
import type { ConversationStatus } from "./schemas/conversation.schema.js";
import type { QualityRating } from "./schemas/phone-number.schema.js";
import type { WhatsAppConnectionStatus } from "./schemas/whatsapp-connection.schema.js";
import type {
  TemplateCategory,
  TemplateComponent,
  TemplateStatus,
} from "./schemas/template.schema.js";
import type { BroadcastStatus } from "./schemas/broadcast.schema.js";
import type { BroadcastRecipientStatus } from "./schemas/broadcast-recipient.schema.js";
import type { CampaignStatus } from "./schemas/campaign.schema.js";
import type { AssignmentStrategy } from "./schemas/automation-settings.schema.js";

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

export interface BroadcastSummary {
  id: string;
  name: string;
  templateId: string;
  phoneNumberId: string;
  campaignId: string | null;
  bodyParameters: string[];
  status: BroadcastStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface BroadcastRecipientSummary {
  id: string;
  contactId: string;
  status: BroadcastRecipientStatus;
  messageId: string | null;
  errorDetail: string | null;
  sentAt: string | null;
}

export interface CampaignSummary {
  id: string;
  name: string;
  phoneNumberId: string;
  targetContactIds: string[];
  status: CampaignStatus;
  completedAt: string | null;
  createdAt: string;
}

export interface CampaignStatsSummary {
  waveCount: number;
  pending: number;
  sent: number;
  failed: number;
  total: number;
}

export interface AutomationSettingsSummary {
  welcomeMessageEnabled: boolean;
  welcomeMessageText: string | null;
  awayMessageEnabled: boolean;
  awayMessageText: string | null;
  assignmentStrategy: AssignmentStrategy;
  updatedAt: string | null;
}
