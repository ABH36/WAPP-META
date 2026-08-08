import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformInvoicesService } from "../services/platform-invoices.service.js";
import { ListInvoicesQueryDto } from "../dto/list-invoices-query.dto.js";
import { VoidInvoiceDto } from "../dto/void-invoice.dto.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";
import type { InvoiceSummary } from "../../billing/billing.types.js";
import type { ListInvoicesForPlatformResult } from "../../billing/services/invoice.service.js";

/** §4.2/§9 — GET /platform/invoices, PATCH /platform/invoices/:id/void. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/invoices", version: "1" })
export class PlatformInvoicesController {
  constructor(private readonly platformInvoicesService: PlatformInvoicesService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get()
  async list(@Query() query: ListInvoicesQueryDto): Promise<ListInvoicesForPlatformResult> {
    return this.platformInvoicesService.list(
      { workspaceId: query.workspaceId, status: query.status },
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get(":id")
  async get(@Param("id") id: string): Promise<InvoiceSummary> {
    return this.platformInvoicesService.getById(id);
  }

  // §7 has no dedicated Invoice permission — MANAGE_PAYMENTS gates it (Invoice/Payment are the same financial-document domain; PaymentService already writes Invoice state directly via markPaidFromPayment/markRefunded). Both MANAGE_PAYMENTS and MANAGE_SUBSCRIPTIONS are Super-Admin-only per the approved grant table, so this choice has no practical permission-outcome difference — see docs/ADR-PLAT-003-platform-billing-operations-boundary.md.
  @RequirePlatformPermission(PlatformPermission.MANAGE_PAYMENTS)
  @Patch(":id/void")
  async void(
    @Param("id") id: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<InvoiceSummary> {
    return this.platformInvoicesService.void(id, dto.reason, user.platformUserId);
  }
}
