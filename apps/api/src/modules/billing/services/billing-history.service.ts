import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { BillingHistoryRecordedPayload } from "../../../common/events/domain-events.js";
import { BillingHistoryRepository } from "../repositories/billing-history.repository.js";

/**
 * §6/§10 — writes one immutable entry per Billing domain event, then emits
 * BILLING_HISTORY_RECORDED (§10's own literal 8th event — a
 * "something new happened in Billing" signal for any future listener that
 * doesn't care what, distinct from the specific event that triggered it).
 * Called only by BillingHistoryListener.
 */
@Injectable()
export class BillingHistoryService {
  constructor(
    private readonly billingHistoryRepository: BillingHistoryRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async record(
    workspaceId: string,
    eventType: string,
    description: string,
    metadata: object,
    occurredAt: Date,
  ): Promise<void> {
    const entry = await this.billingHistoryRepository.record({
      workspaceId,
      eventType,
      description,
      metadata,
      occurredAt,
    });

    this.eventEmitter.emit(DomainEvent.BILLING_HISTORY_RECORDED, {
      workspaceId,
      entryId: entry._id.toString(),
      eventType,
      occurredAt: occurredAt.toISOString(),
    } satisfies BillingHistoryRecordedPayload);
  }
}
