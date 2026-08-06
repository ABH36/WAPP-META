import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CommunicationModule } from "../communication/communication.module.js";
import { Customer, CustomerSchema } from "./schemas/customer.schema.js";
import { CustomerRepository } from "./repositories/customer.repository.js";
import { CustomerService } from "./services/customer.service.js";
import { CustomerController } from "./controllers/customer.controller.js";

/**
 * CRM (Phase-5). Part-1 (PRD-004 Volume-1 — Customer Management,
 * 2026-08-06) owns `customers` — the canonical business record for a
 * Workspace's customer relationships. Contact stays Communication-owned
 * (ADR-COMM-002); Customer references it, never duplicates it — see
 * docs/ADR-CRM-001-customer-identity-strategy.md.
 *
 * Imports CommunicationModule for its exported ContactRepository —
 * CustomerService resolves/creates the Contact a new Customer references
 * through it, the same cross-module dependency pattern already used for
 * IdentityModule/WorkspaceModule.
 *
 * Part-2 (Lead Management) through Part-6 (CRM Reports & Dashboard) remain
 * later scope, reviewed and approved as their own slices.
 */
@Module({
  imports: [
    CommunicationModule,
    MongooseModule.forFeature([{ name: Customer.name, schema: CustomerSchema }]),
  ],
  controllers: [CustomerController],
  providers: [CustomerRepository, CustomerService],
})
export class CrmModule {}
