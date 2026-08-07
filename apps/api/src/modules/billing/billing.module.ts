import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { Plan, PlanSchema } from "./schemas/plan.schema.js";
import { Subscription, SubscriptionSchema } from "./schemas/subscription.schema.js";
import { PlanRepository } from "./repositories/plan.repository.js";
import { SubscriptionRepository } from "./repositories/subscription.repository.js";
import { PlanService } from "./services/plan.service.js";
import { SubscriptionService } from "./services/subscription.service.js";
import { WorkspaceCreatedListener } from "./listeners/workspace-created.listener.js";
import { SubscriptionLifecycleProcessor } from "./queue/subscription-lifecycle.processor.js";
import { SUBSCRIPTION_LIFECYCLE_QUEUE } from "./billing.constants.js";
import { PlanController } from "./controllers/plan.controller.js";
import { SubscriptionController } from "./controllers/subscription.controller.js";

/**
 * Billing (Phase-6). Part-1 (PRD-005 Volume-1 — Subscription & Plans,
 * 2026-08-07) owns `plans` (platform-global catalog, seeded on boot) and
 * `subscriptions` (one per Workspace, BR-001). Imports WorkspaceModule for
 * WorkspaceRepository — a one-directional dependency (Billing depends on
 * Workspace, never the reverse); the trial Subscription is created
 * reactively via WorkspaceCreatedListener on WORKSPACE_CREATED, not by a
 * direct call from WorkspaceService — see
 * docs/ADR-BILL-001-subscription-ownership-strategy.md and
 * docs/ADR-BILL-002-workspace-billing-synchronization.md.
 *
 * Payments, Invoices, Billing History, Usage/Limits enforcement, and
 * Billing Reports remain later Volumes, reviewed and approved as their own
 * slices — see PRD-005's own §3/§18.
 */
@Module({
  imports: [
    WorkspaceModule,
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    BullModule.registerQueue({ name: SUBSCRIPTION_LIFECYCLE_QUEUE }),
  ],
  controllers: [PlanController, SubscriptionController],
  providers: [
    PlanRepository,
    SubscriptionRepository,
    PlanService,
    SubscriptionService,
    WorkspaceCreatedListener,
    SubscriptionLifecycleProcessor,
  ],
})
export class BillingModule {}
