import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import { IdentityModule } from "../identity/identity.module.js";
import {
  WhatsAppConnection,
  WhatsAppConnectionSchema,
} from "./schemas/whatsapp-connection.schema.js";
import { PhoneNumber, PhoneNumberSchema } from "./schemas/phone-number.schema.js";
import { Contact, ContactSchema } from "./schemas/contact.schema.js";
import { Message, MessageSchema } from "./schemas/message.schema.js";
import { Conversation, ConversationSchema } from "./schemas/conversation.schema.js";
import { ConversationNote, ConversationNoteSchema } from "./schemas/conversation-note.schema.js";
import { Template, TemplateSchema } from "./schemas/template.schema.js";
import { Broadcast, BroadcastSchema } from "./schemas/broadcast.schema.js";
import {
  BroadcastRecipient,
  BroadcastRecipientSchema,
} from "./schemas/broadcast-recipient.schema.js";
import { WhatsAppConnectionRepository } from "./repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "./repositories/phone-number.repository.js";
import { ContactRepository } from "./repositories/contact.repository.js";
import { MessageRepository } from "./repositories/message.repository.js";
import { ConversationRepository } from "./repositories/conversation.repository.js";
import { ConversationNoteRepository } from "./repositories/conversation-note.repository.js";
import { TemplateRepository } from "./repositories/template.repository.js";
import { BroadcastRepository } from "./repositories/broadcast.repository.js";
import { BroadcastRecipientRepository } from "./repositories/broadcast-recipient.repository.js";
import { MetaApiClient } from "./services/meta-api-client.service.js";
import { WhatsAppConnectionService } from "./services/whatsapp-connection.service.js";
import { WebhookService } from "./services/webhook.service.js";
import { MessageService } from "./services/message.service.js";
import { ConversationService } from "./services/conversation.service.js";
import { TemplateService } from "./services/template.service.js";
import { ComplianceEngineService } from "./services/compliance-engine.service.js";
import { BroadcastService } from "./services/broadcast.service.js";
import { WEBHOOK_PROCESSING_QUEUE } from "./queue/webhook-processing.constants.js";
import { WebhookProcessingProcessor } from "./queue/webhook-processing.processor.js";
import { CONVERSATION_AUTO_CLOSE_QUEUE } from "./communication.constants.js";
import { ConversationAutoCloseProcessor } from "./queue/conversation-auto-close.processor.js";
import { BROADCAST_EXECUTION_QUEUE } from "./queue/broadcast-execution.constants.js";
import { BroadcastExecutionProcessor } from "./queue/broadcast-execution.processor.js";
import { WhatsAppConnectionController } from "./controllers/whatsapp-connection.controller.js";
import { WebhookController } from "./controllers/webhook.controller.js";
import { MessageController } from "./controllers/message.controller.js";
import { ConversationController } from "./controllers/conversation.controller.js";
import { TemplateController } from "./controllers/template.controller.js";
import { BroadcastController } from "./controllers/broadcast.controller.js";

/**
 * Communication (Phase-4). Part 1 (PRD-003 Part 1 — Core Messaging Engine &
 * Meta Integration) owns `whatsapp_connections`, `phone_numbers`,
 * `contacts`, `messages`. Part 2 (PRD-003 Part 2 — Shared Team Inbox &
 * Conversation Management, 2026-08-05) adds `conversations` and
 * `conversation_notes`. Part 3a (PRD-003 Part 3 — Templates & Meta
 * Compliance Engine, 2026-08-05) adds `templates` and enforces the 24-hour
 * customer-service-window rule (BDC-008) on every free-text send. Part 3b-i
 * (Broadcast Management, 2026-08-05) adds `broadcasts` and
 * `broadcast_recipients` — a one-time template fan-out to an explicit
 * Contact list (see docs/COMM-BROADCAST-LIFECYCLE.md for the audience-model
 * scoping decision). Campaign (Part 3b-ii), Rule-Based Automation (Part 4),
 * and Analytics (Part 5) remain later scope, reviewed and approved as their
 * own slices.
 *
 * Imports IdentityModule for UserRepository — Part 2's assignment feature
 * needs to validate an assignee is an active workspace member with Shared
 * Inbox access (same cross-module dependency pattern WorkspaceModule
 * already established).
 */
@Module({
  imports: [
    IdentityModule,
    MongooseModule.forFeature([
      { name: WhatsAppConnection.name, schema: WhatsAppConnectionSchema },
      { name: PhoneNumber.name, schema: PhoneNumberSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: ConversationNote.name, schema: ConversationNoteSchema },
      { name: Template.name, schema: TemplateSchema },
      { name: Broadcast.name, schema: BroadcastSchema },
      { name: BroadcastRecipient.name, schema: BroadcastRecipientSchema },
    ]),
    BullModule.registerQueue(
      { name: WEBHOOK_PROCESSING_QUEUE },
      { name: CONVERSATION_AUTO_CLOSE_QUEUE },
      { name: BROADCAST_EXECUTION_QUEUE },
    ),
  ],
  controllers: [
    WhatsAppConnectionController,
    WebhookController,
    MessageController,
    ConversationController,
    TemplateController,
    BroadcastController,
  ],
  providers: [
    WhatsAppConnectionRepository,
    PhoneNumberRepository,
    ContactRepository,
    MessageRepository,
    ConversationRepository,
    ConversationNoteRepository,
    TemplateRepository,
    BroadcastRepository,
    BroadcastRecipientRepository,
    MetaApiClient,
    WhatsAppConnectionService,
    WebhookService,
    MessageService,
    ConversationService,
    TemplateService,
    ComplianceEngineService,
    BroadcastService,
    WebhookProcessingProcessor,
    ConversationAutoCloseProcessor,
    BroadcastExecutionProcessor,
  ],
})
export class CommunicationModule {}
