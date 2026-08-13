import { Body, Controller, ForbiddenException, Get, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Permission, TenantRole } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { PaymentService } from "../services/payment.service.js";
import { RecordPaymentDto } from "../dto/record-payment.dto.js";
import { RefundPaymentDto } from "../dto/refund-payment.dto.js";
import type { PaymentSummary } from "../billing.types.js";

/**
 * §11/§14 — Payment Gateway Integration is Out of Scope, so POST
 * /billing/payments and POST /billing/refunds are manual recording actions,
 * not customer self-service. Resolved 2026-08-07, Architecture Review:
 * platform-operator-only — but no platform-operator concept exists in this
 * codebase yet (PlatformRole is pre-scaffolded with zero consumers;
 * Platform Administration is a later, unbuilt module — PRD-007). Until
 * then, these two endpoints are additionally restricted to TenantRole.OWNER
 * specifically (narrower than BILLING_ACCESS alone, which — per
 * PermissionsGuard's binary NONE-vs-not-NONE check — would also let
 * Administrator's VIEW_ONLY through). This is a known, tracked interim gap,
 * not the intended long-term access model — see TD-010 and
 * docs/ADR-BILL-004-invoice-payment-relationship.md.
 */
// PHD-001 Volume-1 — money-moving actions, well below the app-wide 300/min
// default (app.module.ts): a compromised/scripted Owner session should not
// be able to hammer payment recording or refunds.
const PAYMENT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@Controller({ path: "billing", version: "1" })
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("payments")
  async list(@CurrentUser() user: AuthenticatedUser): Promise<PaymentSummary[]> {
    return this.paymentService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Get("payments/:id")
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<PaymentSummary> {
    return this.paymentService.getForWorkspace(user.workspaceId!, id);
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Throttle(PAYMENT_THROTTLE)
  @Post("payments")
  async record(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordPaymentDto,
  ): Promise<PaymentSummary> {
    this.ensureOwner(user);
    return this.paymentService.record(
      user.workspaceId!,
      dto.invoiceId,
      dto.gateway,
      dto.gatewayReference,
      dto.amount,
      dto.currency,
      dto.outcome,
      user.userId,
    );
  }

  @RequirePermission(Permission.BILLING_ACCESS)
  @Throttle(PAYMENT_THROTTLE)
  @Post("refunds")
  async refund(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefundPaymentDto,
  ): Promise<PaymentSummary> {
    this.ensureOwner(user);
    return this.paymentService.refund(user.workspaceId!, dto.paymentId, user.userId);
  }

  private ensureOwner(user: AuthenticatedUser): void {
    if (user.role !== TenantRole.OWNER) {
      throw new ForbiddenException("Only the Workspace Owner can record Payments or Refunds");
    }
  }
}
