import { createHmac, timingSafeEqual } from "node:crypto";
import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { AppConfig } from "../../../config/configuration.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { MessageReceivedPayload } from "../../../common/events/domain-events.js";
import { ContactRepository } from "../repositories/contact.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { AutomationService } from "./automation.service.js";
import { AutoAssignmentService } from "./auto-assignment.service.js";
import { MessageDirection, MessageStatus, MessageType } from "../schemas/message.schema.js";

interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  [key: string]: unknown;
}

interface MetaWebhookStatus {
  id: string;
  status: string;
  timestamp: string;
  errors?: Array<{ message?: string }>;
  [key: string]: unknown;
}

interface MetaWebhookValue {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
}

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; changes?: Array<{ value?: MetaWebhookValue; field?: string }> }>;
}

const MESSAGE_TYPE_MAP: Record<string, MessageType> = {
  text: MessageType.TEXT,
  image: MessageType.IMAGE,
  document: MessageType.DOCUMENT,
  audio: MessageType.AUDIO,
  video: MessageType.VIDEO,
  sticker: MessageType.STICKER,
  location: MessageType.LOCATION,
  contacts: MessageType.CONTACTS,
  interactive: MessageType.INTERACTIVE,
};

const STATUS_MAP: Record<string, MessageStatus> = {
  sent: MessageStatus.SENT,
  delivered: MessageStatus.DELIVERED,
  read: MessageStatus.READ,
  failed: MessageStatus.FAILED,
};

/**
 * Owns the webhook receiver's two security-critical checks (subscription
 * verification handshake, payload signature verification) and inbound
 * event processing. Every method here is pure/deterministic given its
 * inputs — no direct Express/Nest request handling — so it's fully unit-
 * and e2e-testable without needing a live Meta call.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly phoneNumberRepository: PhoneNumberRepository,
    private readonly contactRepository: ContactRepository,
    private readonly messageRepository: MessageRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly automationService: AutomationService,
    private readonly autoAssignmentService: AutoAssignmentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Meta's one-time subscription handshake (GET). Returns the challenge to echo back, or null if the verify token doesn't match. */
  verifySubscription(mode: string | undefined, verifyToken: string | undefined): boolean {
    const { webhookVerifyToken } = this.config.get("meta", { infer: true });
    return mode === "subscribe" && verifyToken === webhookVerifyToken;
  }

  /**
   * X-Hub-Signature-256 verification — Meta signs every webhook POST with
   * HMAC-SHA256 over the raw request body, keyed by the App Secret. Must be
   * checked against the *raw* bytes (see main.ts's `rawBody: true`), not a
   * re-serialized JSON object, or a semantically-identical payload with
   * different key order/whitespace would fail verification.
   */
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader?.startsWith("sha256=")) {
      return false;
    }
    const { appSecret } = this.config.get("meta", { infer: true });
    const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const provided = signatureHeader.slice("sha256=".length);

    // Different-length buffers would throw in timingSafeEqual rather than
    // safely return false — checked explicitly first.
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Processes an already-signature-verified webhook payload. Never throws
   * on malformed/unrecognized content — a webhook endpoint that 500s on a
   * payload shape it doesn't understand risks Meta disabling the
   * subscription after repeated failures; unrecognized entries are logged
   * and skipped instead (idempotent — safe to be called again on redelivery).
   */
  async processEvent(payload: unknown): Promise<void> {
    const body = payload as MetaWebhookPayload;
    if (body.object !== "whatsapp_business_account") {
      return;
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        for (const message of value.messages ?? []) {
          await this.handleInboundMessage(value, message);
        }
        for (const status of value.statuses ?? []) {
          await this.handleStatusUpdate(status);
        }
      }
    }
  }

  private async handleInboundMessage(
    value: MetaWebhookValue,
    message: MetaWebhookMessage,
  ): Promise<void> {
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId) {
      this.logger.warn(`Inbound message ${message.id} missing metadata.phone_number_id`);
      return;
    }

    const phoneNumber = await this.phoneNumberRepository.findByPhoneNumberId(phoneNumberId);
    if (!phoneNumber) {
      // A webhook for a number we don't have on record (stale subscription,
      // disconnected workspace) — nothing to attach this message to.
      this.logger.warn(`No PhoneNumber found for Meta phone_number_id ${phoneNumberId}`);
      return;
    }

    // Idempotency — Meta may redeliver the same webhook.
    const existing = await this.messageRepository.findByWaMessageId(message.id);
    if (existing) {
      return;
    }

    const profileName =
      value.contacts?.find((contact) => contact.wa_id === message.from)?.profile?.name ?? null;
    const contact = await this.contactRepository.findOrCreate(
      phoneNumber.workspaceId,
      `+${message.from}`,
      profileName,
    );

    const occurredAt = new Date(Number(message.timestamp) * 1000);
    const conversation = await this.conversationRepository.recordActivity(
      phoneNumber.workspaceId,
      contact._id.toString(),
      phoneNumber._id.toString(),
      MessageDirection.INBOUND,
      occurredAt,
    );

    await this.messageRepository.create({
      workspaceId: phoneNumber.workspaceId,
      conversationId: conversation._id.toString(),
      phoneNumberId: phoneNumber._id.toString(),
      contactId: contact._id.toString(),
      direction: MessageDirection.INBOUND,
      type: MESSAGE_TYPE_MAP[message.type] ?? MessageType.UNKNOWN,
      text: message.text?.body ?? null,
      rawPayload: message,
      waMessageId: message.id,
      // VISIBLE, not RECEIVED — the Conversation/Shared Inbox this state was
      // reserved for now exists, and there's no gating step between receipt
      // and inbox visibility yet (see message.schema.ts's 2026-08-05 note).
      status: MessageStatus.VISIBLE,
      occurredAt,
    });

    this.eventEmitter.emit(DomainEvent.MESSAGE_RECEIVED, {
      workspaceId: phoneNumber.workspaceId,
      conversationId: conversation._id.toString(),
      contactId: contact._id.toString(),
      phoneNumberId: phoneNumber._id.toString(),
      waMessageId: message.id,
      occurredAt: new Date().toISOString(),
    } satisfies MessageReceivedPayload);

    // Part 4a — Welcome/Away auto-reply, evaluated after the inbound
    // message is fully persisted. Never throws (see AutomationService's
    // own doc comment) so a Welcome/Away failure can't fail this webhook.
    await this.automationService.maybeSendAutoReply(
      phoneNumber.workspaceId,
      conversation,
      phoneNumber._id.toString(),
      contact.phoneNumber,
    );

    // Part 4b — Auto Assignment, evaluated after Welcome/Away (canonical
    // inbound-message automation order, ADR-COMM-011). Also never throws.
    await this.autoAssignmentService.maybeAssign(phoneNumber.workspaceId, conversation);
  }

  private async handleStatusUpdate(status: MetaWebhookStatus): Promise<void> {
    const mapped = STATUS_MAP[status.status];
    if (!mapped) {
      this.logger.warn(`Unrecognized status value "${status.status}" for ${status.id}`);
      return;
    }
    await this.messageRepository.updateStatusByWaMessageId(
      status.id,
      mapped,
      status.errors?.[0]?.message ?? null,
    );
  }
}

/** Thrown by the controller when signature verification fails — kept here so the controller doesn't need its own exception type. */
export class InvalidWebhookSignatureException extends ForbiddenException {
  constructor() {
    super("Invalid webhook signature");
  }
}
