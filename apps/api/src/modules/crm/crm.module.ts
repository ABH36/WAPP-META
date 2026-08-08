import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { IdentityModule } from "../identity/identity.module.js";
import { WorkspaceModule } from "../workspace/workspace.module.js";
import { CommunicationModule } from "../communication/communication.module.js";
import { Customer, CustomerSchema } from "./schemas/customer.schema.js";
import { Lead, LeadSchema } from "./schemas/lead.schema.js";
import { Deal, DealSchema } from "./schemas/deal.schema.js";
import { Activity, ActivitySchema } from "./schemas/activity.schema.js";
import { CustomerRepository } from "./repositories/customer.repository.js";
import { LeadRepository } from "./repositories/lead.repository.js";
import { DealRepository } from "./repositories/deal.repository.js";
import { ActivityRepository } from "./repositories/activity.repository.js";
import { ReportsRepository } from "./repositories/reports.repository.js";
import { CustomerService } from "./services/customer.service.js";
import { LeadService } from "./services/lead.service.js";
import { LeadConversionService } from "./services/lead-conversion.service.js";
import { DealService } from "./services/deal.service.js";
import { ActivityService } from "./services/activity.service.js";
import { ReportsService } from "./services/reports.service.js";
import { CustomerController } from "./controllers/customer.controller.js";
import { LeadController } from "./controllers/lead.controller.js";
import { DealController } from "./controllers/deal.controller.js";
import { ActivityController } from "./controllers/activity.controller.js";
import { ReportsController } from "./controllers/reports.controller.js";

/**
 * CRM (Phase-5). Part-1 (PRD-004 Volume-1 — Customer Management,
 * 2026-08-06) owns `customers` — the canonical business record for a
 * Workspace's customer relationships. Contact stays Communication-owned
 * (ADR-COMM-002); Customer references it, never duplicates it — see
 * docs/ADR-CRM-001-customer-identity-strategy.md.
 *
 * Part-2 (Lead Management, PRD-004 Volume-2, 2026-08-06) adds `leads` —
 * sales-qualification-owned, referencing Contact (always) and Customer
 * (optionally, §12) without duplicating either — see
 * docs/ADR-CRM-006-lead-ownership-strategy.md. Reuses CommunicationModule's
 * exported ContactRepository the same way Customer does, and imports
 * IdentityModule directly for UserRepository (Lead assignment eligibility,
 * §10 — not available transitively through CommunicationModule, which
 * doesn't re-export it).
 *
 * Part-3 (Lead Conversion, PRD-004 Volume-3, 2026-08-06) adds `deals` — a
 * deliberately minimal Deal record (workspaceId/contactId/customerId/
 * sourceLeadId + a starting stage), owned by the conversion workflow, not
 * a persistent entity of its own (§3) — see
 * docs/ADR-CRM-010-deal-creation-boundary.md. LeadConversionService runs
 * Customer resolution/creation, Deal creation, and marking the Lead
 * converted inside one Mongo transaction (BR-008,
 * docs/ADR-CRM-009-lead-conversion-strategy.md) — the first transactional
 * write path in this codebase, made possible by the dev replica-set change
 * in docs/ADR-INFRA-001-mongo-replica-set-strategy.md. Imports
 * WorkspaceModule for WorkspaceRepository (§4's Workspace-Active
 * precondition).
 *
 * Part-4 (Deal Management, PRD-004 Volume-4, 2026-08-06) owns `deals` from
 * here on — the full pipeline/commercial lifecycle (query, general update,
 * assignment, stage transitions, reopen). Lead Conversion (Part-3) remains
 * the only creation path; DealService never creates a Deal itself — see
 * docs/ADR-CRM-012-deal-lifecycle-strategy.md.
 *
 * Part-5 (Activities, Tasks, Follow-ups & Notes, PRD-004 Volume-5,
 * 2026-08-07) adds `activities` — a single, type-discriminated collection
 * (Task/Follow-up/Note/Reminder/Call/Meeting/Email) referencing Customer
 * and/or Deal without owning either — see
 * docs/ADR-CRM-015-activity-timeline-strategy.md and
 * docs/ADR-CRM-016-activity-ownership-strategy.md. Has no permission of its
 * own; access is inherited from whichever record an Activity references,
 * checked inline in ActivityService rather than via `@RequirePermission`.
 *
 * Part-6 (CRM Reports & Dashboard, PRD-004 Volume-6, 2026-08-07) adds no
 * new collection — Reports never owns transactional data (§3), it only
 * reads across Customer/Lead/Deal/Activity's existing models via
 * aggregation. ReportsRepository injects those four models directly
 * (already registered above) rather than routing through their own
 * CRUD-oriented repositories — see
 * docs/ADR-CRM-019-crm-reporting-strategy.md. `VIEW_REPORTS` (already
 * pre-scaffolded) gates every route with a plain static
 * `@RequirePermission`, workspace-wide like every other permission in this
 * codebase — see docs/ADR-CRM-020-report-visibility-strategy.md. This is
 * the final part of the approved 6-part Phase-5 CRM sequence.
 */
@Module({
  imports: [
    IdentityModule,
    WorkspaceModule,
    CommunicationModule,
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Deal.name, schema: DealSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  controllers: [
    CustomerController,
    LeadController,
    DealController,
    ActivityController,
    ReportsController,
  ],
  providers: [
    CustomerRepository,
    LeadRepository,
    DealRepository,
    ActivityRepository,
    ReportsRepository,
    CustomerService,
    LeadService,
    LeadConversionService,
    DealService,
    ActivityService,
    ReportsService,
  ],
  // CustomerRepository + ReportsService exported for PRD-006 Volume-4 —
  // Settings' Data Export orchestrates CRM's own export logic (Leads/Deals/
  // Activities via ReportsService.exportReport; Customers via
  // CustomerRepository.findAllForWorkspace) rather than duplicating it,
  // same reuse-not-rebuild posture as every other Settings orchestration.
  exports: [ReportsService, CustomerRepository],
})
export class CrmModule {}
