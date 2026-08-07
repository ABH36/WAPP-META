import { Injectable } from "@nestjs/common";
import { UsageHistoryRepository } from "../repositories/usage-history.repository.js";

/**
 * §13 (GET /billing/usage/history). Unlike BillingHistoryService, this does
 * NOT emit a further meta-event after recording — §12 lists no "Usage
 * History Recorded" event (unlike Billing History's literal "Billing
 * History Recorded" in Volume-2 §10). Called only by UsageHistoryListener.
 */
@Injectable()
export class UsageHistoryService {
  constructor(private readonly usageHistoryRepository: UsageHistoryRepository) {}

  async record(
    workspaceId: string,
    eventType: string,
    description: string,
    metadata: object,
    occurredAt: Date,
  ): Promise<void> {
    await this.usageHistoryRepository.record({
      workspaceId,
      eventType,
      description,
      metadata,
      occurredAt,
    });
  }
}
