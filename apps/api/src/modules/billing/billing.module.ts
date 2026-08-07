import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BullModule } from "@nestjs/bullmq";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { Plan, PlanSchema } from "./schemas/plan.schema.js";
import { Subscription, SubscriptionSchema } from "./schemas/subscription.schema.js";
import { Invoice, InvoiceSchema } from "./schemas/invoice.schema.js";
import { Payment, PaymentSchema } from "./schemas/payment.schema.js";
import { InvoiceCounter, InvoiceCounterSchema } from "./schemas/invoice-counter.schema.js";
import {
  BillingHistoryEntry,
  BillingHistoryEntrySchema,
} from "./schemas/billing-history-entry.schema.js";
import { PlanRepository } from "./repositories/plan.repository.js";
import { SubscriptionRepository } from "./repositories/subscription.repository.js";
import { InvoiceRepository } from "./repositories/invoice.repository.js";
import { PaymentRepository } from "./repositories/payment.repository.js";
import { InvoiceCounterRepository } from "./repositories/invoice-counter.repository.js";
import { BillingHistoryRepository } from "./repositories/billing-history.repository.js";
import { PlanService } from "./services/plan.service.js";
import { SubscriptionService } from "./services/subscription.service.js";
import { InvoiceService } from "./services/invoice.service.js";
import { PaymentService } from "./services/payment.service.js";
import { BillingHistoryService } from "./services/billing-history.service.js";
import { WorkspaceCreatedListener } from "./listeners/workspace-created.listener.js";
import { InvoiceGenerationListener } from "./listeners/invoice-generation.listener.js";
import { BillingHistoryListener } from "./listeners/billing-history.listener.js";
import { SubscriptionLifecycleProcessor } from "./queue/subscription-lifecycle.processor.js";
import { InvoiceLifecycleProcessor } from "./queue/invoice-lifecycle.processor.js";
import { SUBSCRIPTION_LIFECYCLE_QUEUE, INVOICE_LIFECYCLE_QUEUE } from "./billing.constants.js";
import { PlanController } from "./controllers/plan.controller.js";
import { SubscriptionController } from "./controllers/subscription.controller.js";
import { InvoiceController } from "./controllers/invoice.controller.js";
import { PaymentController } from "./controllers/payment.controller.js";

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
 * Part-2 (PRD-005 Volume-2 — Invoices & Payments, 2026-08-07) adds
 * `invoices`, `payments`, `invoice_counters` (numbering infrastructure),
 * and `billing_history_entries` (immutable log). Invoice generation is
 * internally triggered off Subscription's own SUBSCRIPTION_UPGRADED event
 * (InvoiceGenerationListener) — Invoice never calls into Subscription,
 * preserving §13's "never modify" constraints — see
 * docs/ADR-BILL-004-invoice-payment-relationship.md and
 * docs/ADR-BILL-005-billing-event-strategy.md.
 *
 * Usage/Limits enforcement and Billing Reports remain later Volumes,
 * reviewed and approved as their own slices — see PRD-005's own §3/§18.
 */
@Module({
  imports: [
    WorkspaceModule,
    MongooseModule.forFeature([
      { name: Plan.name, schema: PlanSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: InvoiceCounter.name, schema: InvoiceCounterSchema },
      { name: BillingHistoryEntry.name, schema: BillingHistoryEntrySchema },
    ]),
    BullModule.registerQueue(
      { name: SUBSCRIPTION_LIFECYCLE_QUEUE },
      { name: INVOICE_LIFECYCLE_QUEUE },
    ),
  ],
  controllers: [PlanController, SubscriptionController, InvoiceController, PaymentController],
  providers: [
    PlanRepository,
    SubscriptionRepository,
    InvoiceRepository,
    PaymentRepository,
    InvoiceCounterRepository,
    BillingHistoryRepository,
    PlanService,
    SubscriptionService,
    InvoiceService,
    PaymentService,
    BillingHistoryService,
    WorkspaceCreatedListener,
    InvoiceGenerationListener,
    BillingHistoryListener,
    SubscriptionLifecycleProcessor,
    InvoiceLifecycleProcessor,
  ],
})
export class BillingModule {}
