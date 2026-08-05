import type { Types } from "mongoose";
import type { WhatsAppConnectionDocument } from "../schemas/whatsapp-connection.schema.js";
import type { PhoneNumberDocument } from "../schemas/phone-number.schema.js";
import type { MessageDocument } from "../schemas/message.schema.js";
import type { ContactDocument } from "../schemas/contact.schema.js";
import type { ConversationDocument } from "../schemas/conversation.schema.js";
import type { ConversationNoteDocument } from "../schemas/conversation-note.schema.js";
import type { TemplateDocument } from "../schemas/template.schema.js";
import type { BroadcastDocument } from "../schemas/broadcast.schema.js";
import type { BroadcastRecipientDocument } from "../schemas/broadcast-recipient.schema.js";
import type { CampaignDocument } from "../schemas/campaign.schema.js";
import type {
  AutomationSettingsSummary,
  BroadcastRecipientSummary,
  BroadcastSummary,
  CampaignSummary,
  ConnectionSummary,
  ConversationNoteSummary,
  ConversationSummary,
  MessageSummary,
  PhoneNumberSummary,
  TemplateSummary,
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

export function toTemplateSummary(template: TemplateDocument): TemplateSummary {
  return {
    id: template._id.toString(),
    name: template.name,
    category: template.category,
    language: template.language,
    components: template.components,
    status: template.status,
    metaTemplateId: template.metaTemplateId,
    rejectionReason: template.rejectionReason,
    createdAt: template.createdAt.toISOString(),
  };
}

export function toBroadcastSummary(broadcast: BroadcastDocument): BroadcastSummary {
  return {
    id: broadcast._id.toString(),
    name: broadcast.name,
    templateId: broadcast.templateId.toString(),
    phoneNumberId: broadcast.phoneNumberId.toString(),
    campaignId: broadcast.campaignId ? broadcast.campaignId.toString() : null,
    bodyParameters: broadcast.bodyParameters,
    status: broadcast.status,
    scheduledAt: broadcast.scheduledAt ? broadcast.scheduledAt.toISOString() : null,
    startedAt: broadcast.startedAt ? broadcast.startedAt.toISOString() : null,
    completedAt: broadcast.completedAt ? broadcast.completedAt.toISOString() : null,
    failureReason: broadcast.failureReason,
    createdAt: broadcast.createdAt.toISOString(),
  };
}

export function toBroadcastRecipientSummary(
  recipient: BroadcastRecipientDocument,
): BroadcastRecipientSummary {
  return {
    id: recipient._id.toString(),
    contactId: recipient.contactId.toString(),
    status: recipient.status,
    messageId: recipient.messageId ? recipient.messageId.toString() : null,
    errorDetail: recipient.errorDetail,
    sentAt: recipient.sentAt ? recipient.sentAt.toISOString() : null,
  };
}

export function toCampaignSummary(campaign: CampaignDocument): CampaignSummary {
  return {
    id: campaign._id.toString(),
    name: campaign.name,
    phoneNumberId: campaign.phoneNumberId.toString(),
    targetContactIds: campaign.targetContactIds,
    status: campaign.status,
    completedAt: campaign.completedAt ? campaign.completedAt.toISOString() : null,
    createdAt: campaign.createdAt.toISOString(),
  };
}

/** Accepts either a real AutomationSettings document or AutomationSettingsRepository.findOrDefault()'s plain-object fallback — both share the same field names, only the document has createdAt/updatedAt. */
export function toAutomationSettingsSummary(settings: {
  welcomeMessageEnabled: boolean;
  welcomeMessageText: string | null;
  awayMessageEnabled: boolean;
  awayMessageText: string | null;
  updatedAt?: Date;
}): AutomationSettingsSummary {
  return {
    welcomeMessageEnabled: settings.welcomeMessageEnabled,
    welcomeMessageText: settings.welcomeMessageText,
    awayMessageEnabled: settings.awayMessageEnabled,
    awayMessageText: settings.awayMessageText,
    updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null,
  };
}
