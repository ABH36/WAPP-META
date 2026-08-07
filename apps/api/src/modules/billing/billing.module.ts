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
import { PlanLimits, PlanLimitsSchema } from "./schemas/plan-limits.schema.js";
import { WorkspaceUsage, WorkspaceUsageSchema } from "./schemas/workspace-usage.schema.js";
import {
  UsageHistoryEntry,
  UsageHistoryEntrySchema,
} from "./schemas/usage-history-entry.schema.js";
import { PlanRepository } from "./repositories/plan.repository.js";
import { SubscriptionRepository } from "./repositories/subscription.repository.js";
import { InvoiceRepository } from "./repositories/invoice.repository.js";
import { PaymentRepository } from "./repositories/payment.repository.js";
import { InvoiceCounterRepository } from "./repositories/invoice-counter.repository.js";
import { BillingHistoryRepository } from "./repositories/billing-history.repository.js";
import { PlanLimitsRepository } from "./repositories/plan-limits.repository.js";
import { WorkspaceUsageRepository } from "./repositories/workspace-usage.repository.js";
import { UsageHistoryRepository } from "./repositories/usage-history.repository.js";
import { BillingReportsRepository } from "./repositories/billing-reports.repository.js";
import { PlanService } from "./services/plan.service.js";
import { SubscriptionService } from "./services/subscription.service.js";
import { InvoiceService } from "./services/invoice.service.js";
import { PaymentService } from "./services/payment.service.js";
import { BillingHistoryService } from "./services/billing-history.service.js";
import { PlanLimitsService } from "./services/plan-limits.service.js";
import { UsageService } from "./services/usage.service.js";
import { UsageHistoryService } from "./services/usage-history.service.js";
import { BillingReportsService } from "./services/billing-reports.service.js";
import { WorkspaceCreatedListener } from "./listeners/workspace-created.listener.js";
import { InvoiceGenerationListener } from "./listeners/invoice-generation.listener.js";
import { BillingHistoryListener } from "./listeners/billing-history.listener.js";
import { UsageCounterListener } from "./listeners/usage-counter.listener.js";
import { PlanChangeUsageListener } from "./listeners/plan-change-usage.listener.js";
import { UsageHistoryListener } from "./listeners/usage-history.listener.js";
import { SubscriptionLifecycleProcessor } from "./queue/subscription-lifecycle.processor.js";
import { InvoiceLifecycleProcessor } from "./queue/invoice-lifecycle.processor.js";
import { SUBSCRIPTION_LIFECYCLE_QUEUE, INVOICE_LIFECYCLE_QUEUE } from "./billing.constants.js";
import { PlanController } from "./controllers/plan.controller.js";
import { SubscriptionController } from "./controllers/subscription.controller.js";
import { InvoiceController } from "./controllers/invoice.controller.js";
import { PaymentController } from "./controllers/payment.controller.js";
import { UsageController } from "./controllers/usage.controller.js";
import { BillingReportsController } from "./controllers/billing-reports.controller.js";

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
 * Part-3 (PRD-005 Volume-3 — Usage, Limits & Enforcement, 2026-08-07) adds
 * `plan_limits` (new, separate Usage-owned collection keyed by planId — the
 * frozen Plan schema stays untouched), `workspace_usage` (one document per
 * Workspace, event-driven monotonic counters), and `usage_history_entries`.
 * This volume builds the enforcement *engine* only (UsageService.checkLimit
 * /checkFeatureEnabled, for future callers) — retrofitting CRM/
 * Communication's own mutation paths to actually call it is explicit,
 * separate, individually-approved future work; nothing in this codebase
 * calls those methods yet. See
 * docs/ADR-BILL-007-usage-counter-strategy.md and
 * docs/ADR-BILL-008-commercial-enforcement-strategy.md.
 *
 * Part-4 (PRD-005 Volume-4 — Billing Reports & Administration, 2026-08-07)
 * adds no new schema — a pure, workspace-scoped read/aggregation layer over
 * Subscription/Invoice/Payment/Usage (resolved 2026-08-07, Architecture
 * Review, matching CRM Reports' own precedent — never a cross-tenant
 * aggregation). See docs/ADR-BILL-010-billing-reporting-boundary.md.
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
      { name: PlanLimits.name, schema: PlanLimitsSchema },
      { name: WorkspaceUsage.name, schema: WorkspaceUsageSchema },
      { name: UsageHistoryEntry.name, schema: UsageHistoryEntrySchema },
    ]),
    BullModule.registerQueue(
      { name: SUBSCRIPTION_LIFECYCLE_QUEUE },
      { name: INVOICE_LIFECYCLE_QUEUE },
    ),
  ],
  controllers: [
    PlanController,
    SubscriptionController,
    InvoiceController,
    PaymentController,
    UsageController,
    BillingReportsController,
  ],
  providers: [
    PlanRepository,
    SubscriptionRepository,
    InvoiceRepository,
    PaymentRepository,
    InvoiceCounterRepository,
    BillingHistoryRepository,
    PlanLimitsRepository,
    WorkspaceUsageRepository,
    UsageHistoryRepository,
    BillingReportsRepository,
    PlanService,
    SubscriptionService,
    InvoiceService,
    PaymentService,
    BillingHistoryService,
    PlanLimitsService,
    UsageService,
    UsageHistoryService,
    BillingReportsService,
    WorkspaceCreatedListener,
    InvoiceGenerationListener,
    BillingHistoryListener,
    UsageCounterListener,
    PlanChangeUsageListener,
    UsageHistoryListener,
    SubscriptionLifecycleProcessor,
    InvoiceLifecycleProcessor,
  ],
  exports: [UsageService],
})
export class BillingModule {}
