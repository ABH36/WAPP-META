import { Injectable, Logger } from "@nestjs/common";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import {
  AutomationSettingsRepository,
  type UpdateAutomationSettingsInput,
} from "../repositories/automation-settings.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { MessageService } from "./message.service.js";
import { isWithinBusinessHours } from "../business-hours.util.js";
import { toAutomationSettingsSummary } from "../mappers/communication.mapper.js";
import type { AutomationSettingsSummary } from "../communication.types.js";
import { ConversationStatus, type ConversationDocument } from "../schemas/conversation.schema.js";
import { AUTO_REPLY_COOLDOWN_HOURS } from "../communication.constants.js";

const SYSTEM_ACTOR = "SYSTEM";

/**
 * Part 4a (Automation Engine) — Welcome/Away auto-replies. See
 * docs/COMM-AUTOMATION-BUSINESS-HOURS.md for the full trigger rules and the
 * cooldown/throttling reasoning. Consumes Workspace.businessHours
 * (Phase-3) as-is; owns only the new Welcome/Away configuration
 * (AutomationSettings) and the trigger logic itself.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly automationSettingsRepository: AutomationSettingsRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly messageService: MessageService,
  ) {}

  async getSettings(workspaceId: string): Promise<AutomationSettingsSummary> {
    const settings = await this.automationSettingsRepository.findOrDefault(workspaceId);
    return toAutomationSettingsSummary(settings);
  }

  async updateSettings(
    workspaceId: string,
    input: UpdateAutomationSettingsInput,
    updatedBy: string,
  ): Promise<AutomationSettingsSummary> {
    const settings = await this.automationSettingsRepository.upsert(workspaceId, input, updatedBy);
    return toAutomationSettingsSummary(settings);
  }

  /**
   * Called by WebhookService after every inbound message is persisted.
   * Never throws — a failure here must not fail the inbound webhook
   * request itself (same reasoning WebhookService's own class doc already
   * states for malformed payloads: Meta may disable the subscription after
   * repeated failures).
   */
  async maybeSendAutoReply(
    workspaceId: string,
    conversation: ConversationDocument,
    phoneNumberDbId: string,
    toPhoneNumber: string,
  ): Promise<void> {
    try {
      await this.evaluateAndSend(workspaceId, conversation, phoneNumberDbId, toPhoneNumber);
    } catch (error) {
      this.logger.warn(
        `Auto-reply evaluation failed for conversation ${conversation._id.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async evaluateAndSend(
    workspaceId: string,
    conversation: ConversationDocument,
    phoneNumberDbId: string,
    toPhoneNumber: string,
  ): Promise<void> {
    const now = new Date();

    // NEW means this is the Contact's very first-ever message (see
    // conversation-state-machine.ts — NEW is only ever set at creation,
    // never re-entered on reopen) — the Welcome trigger. Anything else
    // falls through to the Away check. Welcome and Away are throttled
    // independently (see Conversation.welcomeLastSentAt/awayLastSentAt) so
    // firing one never blocks the other; each branch checks its own
    // cooldown before ever fetching settings.
    if (conversation.status === ConversationStatus.NEW) {
      if (this.isWithinCooldown(conversation.welcomeLastSentAt, now)) {
        return;
      }
      const settings = await this.automationSettingsRepository.findOrDefault(workspaceId);
      if (settings.welcomeMessageEnabled && settings.welcomeMessageText) {
        await this.send(
          workspaceId,
          conversation,
          phoneNumberDbId,
          toPhoneNumber,
          settings.welcomeMessageText,
          now,
          this.conversationRepository.updateWelcomeLastSentAt.bind(this.conversationRepository),
        );
      }
      return;
    }

    if (this.isWithinCooldown(conversation.awayLastSentAt, now)) {
      return;
    }
    const settings = await this.automationSettingsRepository.findOrDefault(workspaceId);
    if (!settings.awayMessageEnabled || !settings.awayMessageText) {
      return;
    }

    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      return;
    }
    if (isWithinBusinessHours(workspace.businessHours, now)) {
      return;
    }

    await this.send(
      workspaceId,
      conversation,
      phoneNumberDbId,
      toPhoneNumber,
      settings.awayMessageText,
      now,
      this.conversationRepository.updateAwayLastSentAt.bind(this.conversationRepository),
    );
  }

  private isWithinCooldown(lastSentAt: Date | null, now: Date): boolean {
    if (!lastSentAt) {
      return false;
    }
    const elapsedMs = now.getTime() - lastSentAt.getTime();
    return elapsedMs < AUTO_REPLY_COOLDOWN_HOURS * 60 * 60 * 1000;
  }

  private async send(
    workspaceId: string,
    conversation: ConversationDocument,
    phoneNumberDbId: string,
    toPhoneNumber: string,
    text: string,
    at: Date,
    recordSentAt: (id: string, at: Date) => Promise<void>,
  ): Promise<void> {
    await this.messageService.sendText(workspaceId, phoneNumberDbId, SYSTEM_ACTOR, {
      to: toPhoneNumber,
      text,
    });
    await recordSentAt(conversation._id.toString(), at);
  }
}
