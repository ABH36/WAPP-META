import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { ConversationStatus, type ConversationDocument } from "../schemas/conversation.schema.js";
import { SLA_ESCALATION_MANAGER_ROLES, SLA_RESPONSE_HOURS } from "../communication.constants.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type {
  ConversationAssignedPayload,
  ConversationSlaBreachedPayload,
} from "../../../common/events/domain-events.js";

const SYSTEM_ACTOR = "SYSTEM";

/**
 * Part 4c (SLA Monitoring + Escalation Rules) — see
 * docs/COMM-SLA-ESCALATION.md. Runs on a timer (SlaEscalationProcessor),
 * never from a request path — same reasoning ConversationService's own
 * autoCloseInactive() sweep already applies. SLA Monitoring (detection) and
 * Escalation Rules (action) are two steps of the one sweep, per
 * ADR-COMM-011: Escalation never runs without SLA Monitoring's own
 * detection pass immediately before it, in the same call.
 */
@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Called by SlaEscalationProcessor on a timer. Isolates each candidate's
   * failure from the rest of the batch — one bad Conversation must not stop
   * the sweep from escalating the others. Returns the number escalated.
   */
  async runSweep(cutoff: Date): Promise<number> {
    const candidates = await this.conversationRepository.findSlaBreachCandidates(cutoff);

    let escalatedCount = 0;
    for (const conversation of candidates) {
      try {
        await this.escalate(conversation);
        escalatedCount++;
      } catch (error) {
        this.logger.warn(
          `SLA escalation failed for conversation ${conversation._id.toString()}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return escalatedCount;
  }

  private async escalate(conversation: ConversationDocument): Promise<void> {
    const now = new Date();
    const previousAssignedToUserId = conversation.assignedToUserId;

    const eligibleManagers = await this.userRepository.findByWorkspaceRolesActive(
      conversation.workspaceId,
      SLA_ESCALATION_MANAGER_ROLES,
    );

    // No eligible Manager to hand this off to — still report the breach
    // (see docs/COMM-SLA-ESCALATION.md) rather than silently doing nothing;
    // just no reassignment side effect.
    const escalatedToUserId =
      eligibleManagers.length > 0
        ? await this.pickLeastActiveManager(conversation.workspaceId, eligibleManagers)
        : null;

    if (escalatedToUserId) {
      const nextStatus =
        conversation.status === ConversationStatus.NEW ||
        conversation.status === ConversationStatus.OPEN
          ? ConversationStatus.ASSIGNED
          : null;

      const updated = await this.conversationRepository.assign(
        conversation.workspaceId,
        conversation._id.toString(),
        escalatedToUserId,
        nextStatus,
      );
      if (updated) {
        this.eventEmitter.emit(DomainEvent.CONVERSATION_ASSIGNED, {
          workspaceId: conversation.workspaceId,
          conversationId: conversation._id.toString(),
          contactId: updated.contactId.toString(),
          assignedToUserId: escalatedToUserId,
          actorId: SYSTEM_ACTOR,
          occurredAt: now.toISOString(),
        } satisfies ConversationAssignedPayload);
      }
    }

    await this.conversationRepository.updateLastEscalatedAt(conversation._id.toString(), now);

    const breachedSinceHours = conversation.lastCustomerMessageAt
      ? (now.getTime() - conversation.lastCustomerMessageAt.getTime()) / (60 * 60 * 1000)
      : SLA_RESPONSE_HOURS;

    this.eventEmitter.emit(DomainEvent.CONVERSATION_SLA_BREACHED, {
      workspaceId: conversation.workspaceId,
      conversationId: conversation._id.toString(),
      contactId: conversation.contactId.toString(),
      escalatedToUserId,
      previousAssignedToUserId,
      breachedSinceHours,
      occurredAt: now.toISOString(),
    } satisfies ConversationSlaBreachedPayload);
  }

  /** Same Least Active Agent logic Part 4b's AutoAssignmentService already uses, over the Manager pool instead of the front-line agent pool — ties broken by stable createdAt order. */
  private async pickLeastActiveManager(
    workspaceId: string,
    eligibleManagers: { _id: { toString(): string } }[],
  ): Promise<string> {
    const loads = await Promise.all(
      eligibleManagers.map((manager) =>
        this.conversationRepository.countActiveAssignedToUser(workspaceId, manager._id.toString()),
      ),
    );

    let bestIndex = 0;
    for (let i = 1; i < loads.length; i++) {
      if (loads[i]! < loads[bestIndex]!) {
        bestIndex = i;
      }
    }
    return eligibleManagers[bestIndex]!._id.toString();
  }
}
