import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { IdentityModule } from "../identity/identity.module.js";
import { CommunicationModule } from "../communication/communication.module.js";
import { Customer, CustomerSchema } from "./schemas/customer.schema.js";
import { Lead, LeadSchema } from "./schemas/lead.schema.js";
import { CustomerRepository } from "./repositories/customer.repository.js";
import { LeadRepository } from "./repositories/lead.repository.js";
import { CustomerService } from "./services/customer.service.js";
import { LeadService } from "./services/lead.service.js";
import { CustomerController } from "./controllers/customer.controller.js";
import { LeadController } from "./controllers/lead.controller.js";

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
 * Part-3 (Lead Conversion) through Part-6 (CRM Reports & Dashboard) remain
 * later scope, reviewed and approved as their own slices.
 */
@Module({
  imports: [
    IdentityModule,
    CommunicationModule,
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
  ],
  controllers: [CustomerController, LeadController],
  providers: [CustomerRepository, LeadRepository, CustomerService, LeadService],
})
export class CrmModule {}
