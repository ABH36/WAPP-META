import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import { IdentityModule } from "../identity/identity.module.js";
import { WorkspaceModule } from "../workspace/workspace.module.js";
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
import { Campaign, CampaignSchema } from "./schemas/campaign.schema.js";
import {
  AutomationSettings,
  AutomationSettingsSchema,
} from "./schemas/automation-settings.schema.js";
import { WhatsAppConnectionRepository } from "./repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "./repositories/phone-number.repository.js";
import { ContactRepository } from "./repositories/contact.repository.js";
import { MessageRepository } from "./repositories/message.repository.js";
import { ConversationRepository } from "./repositories/conversation.repository.js";
import { ConversationNoteRepository } from "./repositories/conversation-note.repository.js";
import { TemplateRepository } from "./repositories/template.repository.js";
import { BroadcastRepository } from "./repositories/broadcast.repository.js";
import { BroadcastRecipientRepository } from "./repositories/broadcast-recipient.repository.js";
import { CampaignRepository } from "./repositories/campaign.repository.js";
import { AutomationSettingsRepository } from "./repositories/automation-settings.repository.js";
import { MetaApiClient } from "./services/meta-api-client.service.js";
import { WhatsAppConnectionService } from "./services/whatsapp-connection.service.js";
import { WebhookService } from "./services/webhook.service.js";
import { MessageService } from "./services/message.service.js";
import { ConversationService } from "./services/conversation.service.js";
import { TemplateService } from "./services/template.service.js";
import { ComplianceEngineService } from "./services/compliance-engine.service.js";
import { BroadcastService } from "./services/broadcast.service.js";
import { CampaignService } from "./services/campaign.service.js";
import { AutomationService } from "./services/automation.service.js";
import { AutoAssignmentService } from "./services/auto-assignment.service.js";
import { EscalationService } from "./services/escalation.service.js";
import { WEBHOOK_PROCESSING_QUEUE } from "./queue/webhook-processing.constants.js";
import { WebhookProcessingProcessor } from "./queue/webhook-processing.processor.js";
import { CONVERSATION_AUTO_CLOSE_QUEUE, SLA_ESCALATION_QUEUE } from "./communication.constants.js";
import { ConversationAutoCloseProcessor } from "./queue/conversation-auto-close.processor.js";
import { BROADCAST_EXECUTION_QUEUE } from "./queue/broadcast-execution.constants.js";
import { BroadcastExecutionProcessor } from "./queue/broadcast-execution.processor.js";
import { SlaEscalationProcessor } from "./queue/sla-escalation.processor.js";
import { WhatsAppConnectionController } from "./controllers/whatsapp-connection.controller.js";
import { WebhookController } from "./controllers/webhook.controller.js";
import { MessageController } from "./controllers/message.controller.js";
import { ConversationController } from "./controllers/conversation.controller.js";
import { TemplateController } from "./controllers/template.controller.js";
import { BroadcastController } from "./controllers/broadcast.controller.js";
import { CampaignController } from "./controllers/campaign.controller.js";
import { AutomationSettingsController } from "./controllers/automation-settings.controller.js";

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
 * scoping decision). Part 3b-ii (Campaign Management, 2026-08-05) adds
 * `campaigns` — a container orchestrating multiple Broadcasts ("waves") over
 * a timeline, owning no send mechanics of its own (see
 * docs/COMM-CAMPAIGN-LIFECYCLE.md). Part 4a (Automation Engine — Business
 * Hours + Welcome/Away Messages, 2026-08-05) adds `automation_settings` and
 * consumes Workspace.businessHours (Phase-3) as-is (see
 * docs/COMM-AUTOMATION-BUSINESS-HOURS.md). Part 4b (Auto Assignment,
 * 2026-08-05) extends that same `automation_settings` document with an
 * assignment strategy (Round Robin / Least Active Agent) and adds no new
 * collection of its own (see docs/COMM-AUTO-ASSIGNMENT.md). Part 4c (SLA
 * Monitoring + Escalation Rules, 2026-08-06) adds a periodic sweep
 * (`sla-escalation` queue, same shape as the auto-close sweep) that
 * reassigns still-unanswered Conversations to a Manager — see
 * docs/COMM-SLA-ESCALATION.md. Analytics (Part 5) remains later scope.
 *
 * Exports ContactRepository — Phase-5 CRM's CustomerService resolves/creates
 * the Contact a new Customer references through it (ADR-COMM-002, PRD-004
 * Volume-1 §9: Customer references Contact, never duplicates it).
 *
 * Imports IdentityModule for UserRepository (Part 2's assignment feature)
 * and WorkspaceModule for WorkspaceRepository (Part 4a's Business Hours
 * read) — the same cross-module dependency pattern in both directions.
 */
@Module({
  imports: [
    IdentityModule,
    WorkspaceModule,
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
      { name: Campaign.name, schema: CampaignSchema },
      { name: AutomationSettings.name, schema: AutomationSettingsSchema },
    ]),
    // PHD-001 Volume-3 §8/§9 — count-based cleanup retention, unvalidated
    // starting values pending §27 load-test results.
    BullModule.registerQueue(
      {
        name: WEBHOOK_PROCESSING_QUEUE,
        defaultJobOptions: { removeOnComplete: { count: 1000 }, removeOnFail: { count: 5000 } },
      },
      {
        name: CONVERSATION_AUTO_CLOSE_QUEUE,
        defaultJobOptions: { removeOnComplete: { count: 48 }, removeOnFail: { count: 96 } },
      },
      {
        name: BROADCAST_EXECUTION_QUEUE,
        defaultJobOptions: { removeOnComplete: { count: 200 }, removeOnFail: { count: 500 } },
      },
      {
        name: SLA_ESCALATION_QUEUE,
        defaultJobOptions: { removeOnComplete: { count: 48 }, removeOnFail: { count: 96 } },
      },
    ),
  ],
  controllers: [
    WhatsAppConnectionController,
    WebhookController,
    MessageController,
    ConversationController,
    TemplateController,
    BroadcastController,
    CampaignController,
    AutomationSettingsController,
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
    CampaignRepository,
    AutomationSettingsRepository,
    MetaApiClient,
    WhatsAppConnectionService,
    WebhookService,
    MessageService,
    ConversationService,
    TemplateService,
    ComplianceEngineService,
    BroadcastService,
    CampaignService,
    AutomationService,
    AutoAssignmentService,
    EscalationService,
    WebhookProcessingProcessor,
    ConversationAutoCloseProcessor,
    BroadcastExecutionProcessor,
    SlaEscalationProcessor,
  ],
  // WhatsAppConnectionService exported for PRD-006 Volume-3 — Settings
  // orchestrates WhatsApp Test Connection/Disconnect/Refresh Metadata
  // through it rather than owning any connection state itself (same
  // orchestration-not-ownership pattern as ADR-SET-004).
  // MessageRepository exported for PRD-007 Volume-1 — Platform Dashboard's
  // cross-tenant "Total Messages" count.
  exports: [ContactRepository, WhatsAppConnectionService, MessageRepository],
})
export class CommunicationModule {}
