import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { AutomationSettingsRepository } from "../repositories/automation-settings.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { AssignmentStrategy } from "../schemas/automation-settings.schema.js";
import { ConversationStatus, type ConversationDocument } from "../schemas/conversation.schema.js";
import { AUTO_ASSIGNMENT_ELIGIBLE_ROLES } from "../communication.constants.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { ConversationAssignedPayload } from "../../../common/events/domain-events.js";

const SYSTEM_ACTOR = "SYSTEM";

/**
 * Part 4b (Auto Assignment) — see docs/COMM-AUTO-ASSIGNMENT.md for the
 * strategy definitions and eligibility model. Only ever touches a
 * Conversation that has no assignee yet; never reassigns or overrides an
 * existing assignment (per the confirmed Part-4b scope). Reuses
 * ConversationRepository.assign() directly (not ConversationService) —
 * same reasoning ConversationRepository.recordActivity() itself already
 * documents: WebhookService's call chain must not introduce a dependency on
 * ConversationService.
 */
@Injectable()
export class AutoAssignmentService {
  private readonly logger = new Logger(AutoAssignmentService.name);

  constructor(
    private readonly automationSettingsRepository: AutomationSettingsRepository,
    private readonly userRepository: UserRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Called by WebhookService after Welcome/Away evaluation (ADR-COMM-011
   * order). Never throws — same reliability contract as
   * AutomationService.maybeSendAutoReply (ADR-COMM-010): a failure here
   * must not fail the inbound webhook request itself.
   */
  async maybeAssign(workspaceId: string, conversation: ConversationDocument): Promise<void> {
    try {
      await this.evaluateAndAssign(workspaceId, conversation);
    } catch (error) {
      this.logger.warn(
        `Auto-assignment evaluation failed for conversation ${conversation._id.toString()}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async evaluateAndAssign(
    workspaceId: string,
    conversation: ConversationDocument,
  ): Promise<void> {
    if (conversation.assignedToUserId) {
      return;
    }

    const settings = await this.automationSettingsRepository.findOrDefault(workspaceId);
    if (settings.assignmentStrategy === AssignmentStrategy.NONE) {
      return;
    }

    const eligibleAgents = await this.userRepository.findByWorkspaceRolesActive(
      workspaceId,
      AUTO_ASSIGNMENT_ELIGIBLE_ROLES,
    );
    if (eligibleAgents.length === 0) {
      return;
    }

    const selectedUserId =
      settings.assignmentStrategy === AssignmentStrategy.ROUND_ROBIN
        ? this.pickRoundRobin(eligibleAgents, settings.roundRobinLastAssignedUserId)
        : await this.pickLeastActive(workspaceId, eligibleAgents);

    // Mirrors ConversationService.assign()'s own transition rule: assigning
    // a fresh/unassigned NEW or OPEN conversation promotes it to ASSIGNED;
    // any other status (e.g. PENDING) is left alone — assignment alone
    // doesn't imply a lifecycle change there.
    const nextStatus =
      conversation.status === ConversationStatus.NEW ||
      conversation.status === ConversationStatus.OPEN
        ? ConversationStatus.ASSIGNED
        : null;

    const updated = await this.conversationRepository.assign(
      workspaceId,
      conversation._id.toString(),
      selectedUserId,
      nextStatus,
    );
    if (!updated) {
      return;
    }

    if (settings.assignmentStrategy === AssignmentStrategy.ROUND_ROBIN) {
      await this.automationSettingsRepository.recordRoundRobinAssignment(
        workspaceId,
        selectedUserId,
      );
    }

    this.eventEmitter.emit(DomainEvent.CONVERSATION_ASSIGNED, {
      workspaceId,
      conversationId: conversation._id.toString(),
      contactId: updated.contactId.toString(),
      assignedToUserId: selectedUserId,
      actorId: SYSTEM_ACTOR,
      occurredAt: new Date().toISOString(),
    } satisfies ConversationAssignedPayload);
  }

  /** Starts after whoever was picked last time; wraps around; restarts at the first eligible agent if there's no prior pick or that agent is no longer eligible. */
  private pickRoundRobin(
    eligibleAgents: { _id: { toString(): string } }[],
    lastAssignedUserId: string | null,
  ): string {
    const ids = eligibleAgents.map((agent) => agent._id.toString());
    const lastIndex = lastAssignedUserId ? ids.indexOf(lastAssignedUserId) : -1;
    const nextIndex = (lastIndex + 1) % ids.length;
    return ids[nextIndex]!;
  }

  /** Ties broken by the stable eligible-agent order (createdAt ascending) — deterministic, not random. */
  private async pickLeastActive(
    workspaceId: string,
    eligibleAgents: { _id: { toString(): string } }[],
  ): Promise<string> {
    const loads = await Promise.all(
      eligibleAgents.map((agent) =>
        this.conversationRepository.countActiveAssignedToUser(workspaceId, agent._id.toString()),
      ),
    );

    let bestIndex = 0;
    for (let i = 1; i < loads.length; i++) {
      if (loads[i]! < loads[bestIndex]!) {
        bestIndex = i;
      }
    }
    return eligibleAgents[bestIndex]!._id.toString();
  }
}
