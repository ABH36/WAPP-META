import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ConfigService } from "@nestjs/config";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { WorkspaceCreatedPayload } from "../../../common/events/domain-events.js";
import type { AppConfig } from "../../../config/configuration.js";
import { SubscriptionService } from "../services/subscription.service.js";

/**
 * PRD-005 Volume-1 §7/BR-002 — creates the one-per-Workspace trial
 * Subscription reactively, keeping WorkspaceModule -> BillingModule as a
 * one-directional dependency (WorkspaceService never imports or calls into
 * Billing directly — see docs/ADR-BILL-001-subscription-ownership-strategy.md).
 * `trialDurationDays` is read from the same `workspace` config namespace
 * WorkspaceService used to read it from — the config key and env var name
 * weren't renamed even though ownership of the value moved to Billing, to
 * avoid an unnecessary deployment-config break.
 */
@Injectable()
export class WorkspaceCreatedListener {
  private readonly logger = new Logger(WorkspaceCreatedListener.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @OnEvent(DomainEvent.WORKSPACE_CREATED)
  async onWorkspaceCreated(payload: WorkspaceCreatedPayload): Promise<void> {
    const { trialDurationDays } = this.config.get("workspace", { infer: true });
    await this.subscriptionService.createTrialForWorkspace(
      payload.workspaceId,
      trialDurationDays,
      payload.ownerId,
    );
    this.logger.log(`Trial Subscription created for workspace ${payload.workspaceId}`);
  }
}
