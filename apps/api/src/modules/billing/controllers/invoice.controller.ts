import { Controller, Get, Param } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { InvoiceService } from "../services/invoice.service.js";
import type { InvoiceSummary } from "../billing.types.js";

/**
 * §11/§15 — read-only. No POST /billing/invoices: Invoice generation is
 * internal only (InvoiceGenerationListener), never user-triggered — see
 * docs/ADR-BILL-004-invoice-payment-relationship.md. BILLING_ACCESS is the
 * existing, pre-scaffolded permission (Owner FULL, Administrator
 * VIEW_ONLY) — reused as-is for reads.
 */
@Controller({ path: "billing/invoices", version: "1" })
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<InvoiceSummary[]> {
    return this.invoiceService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get(":id")
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<InvoiceSummary> {
    return this.invoiceService.getForWorkspace(user.workspaceId!, id);
  }
}
