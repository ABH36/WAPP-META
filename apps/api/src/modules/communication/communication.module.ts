import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import {
  WhatsAppConnection,
  WhatsAppConnectionSchema,
} from "./schemas/whatsapp-connection.schema.js";
import { PhoneNumber, PhoneNumberSchema } from "./schemas/phone-number.schema.js";
import { Contact, ContactSchema } from "./schemas/contact.schema.js";
import { Message, MessageSchema } from "./schemas/message.schema.js";
import { WhatsAppConnectionRepository } from "./repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "./repositories/phone-number.repository.js";
import { ContactRepository } from "./repositories/contact.repository.js";
import { MessageRepository } from "./repositories/message.repository.js";
import { MetaApiClient } from "./services/meta-api-client.service.js";
import { WhatsAppConnectionService } from "./services/whatsapp-connection.service.js";
import { WebhookService } from "./services/webhook.service.js";
import { MessageService } from "./services/message.service.js";
import { WEBHOOK_PROCESSING_QUEUE } from "./queue/webhook-processing.constants.js";
import { WebhookProcessingProcessor } from "./queue/webhook-processing.processor.js";
import { WhatsAppConnectionController } from "./controllers/whatsapp-connection.controller.js";
import { WebhookController } from "./controllers/webhook.controller.js";
import { MessageController } from "./controllers/message.controller.js";

/**
 * Communication (Phase-4, PRD-003 Part 1 — Core Messaging Engine & Meta
 * Integration). Owns `whatsapp_connections`, `phone_numbers`, `contacts`,
 * `messages`. Scope deliberately excludes Shared Team Inbox/Conversation
 * lifecycle (Part 2), Broadcast/Campaign/Templates (Part 3), Rule-Based
 * Automation (Part 4), and Analytics (Part 5) — each is later scope,
 * reviewed and approved as its own slice, same discipline as every module
 * so far.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WhatsAppConnection.name, schema: WhatsAppConnectionSchema },
      { name: PhoneNumber.name, schema: PhoneNumberSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    BullModule.registerQueue({ name: WEBHOOK_PROCESSING_QUEUE }),
  ],
  controllers: [WhatsAppConnectionController, WebhookController, MessageController],
  providers: [
    WhatsAppConnectionRepository,
    PhoneNumberRepository,
    ContactRepository,
    MessageRepository,
    MetaApiClient,
    WhatsAppConnectionService,
    WebhookService,
    MessageService,
    WebhookProcessingProcessor,
  ],
})
export class CommunicationModule {}
