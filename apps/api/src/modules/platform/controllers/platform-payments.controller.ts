import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformPaymentsService } from "../services/platform-payments.service.js";
import { ListPaymentsQueryDto } from "../dto/list-payments-query.dto.js";
import { RecordPlatformPaymentDto } from "../dto/record-platform-payment.dto.js";
import { RefundPlatformPaymentDto } from "../dto/refund-platform-payment.dto.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";
import type { PaymentSummary } from "../../billing/billing.types.js";
import type { ListPaymentsForPlatformResult } from "../../billing/services/payment.service.js";

// Security requirement (Architecture Review, 2026-08-08) — reuse the same
// stricter throttle tier already applied to the tenant Payment/Refund
// endpoints (SEC-009, 5 requests/minute) and Platform Auth.
const PLATFORM_PAYMENT_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

/** §4.3/§9 — GET /platform/payments, POST /platform/payments/manual, POST /platform/payments/:id/refund. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/payments", version: "1" })
export class PlatformPaymentsController {
  constructor(private readonly platformPaymentsService: PlatformPaymentsService) {}

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get()
  async list(@Query() query: ListPaymentsQueryDto): Promise<ListPaymentsForPlatformResult> {
    return this.platformPaymentsService.list(
      { workspaceId: query.workspaceId, status: query.status },
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @RequirePlatformPermission(PlatformPermission.VIEW_PLATFORM_BILLING)
  @Get(":id")
  async get(@Param("id") id: string): Promise<PaymentSummary> {
    return this.platformPaymentsService.getById(id);
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_PAYMENTS)
  @Throttle(PLATFORM_PAYMENT_THROTTLE)
  @Post("manual")
  async recordManual(
    @Body() dto: RecordPlatformPaymentDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<PaymentSummary> {
    return this.platformPaymentsService.recordManual(
      dto.workspaceId,
      dto.invoiceId,
      dto.gateway,
      dto.gatewayReference,
      dto.amount,
      dto.currency,
      dto.outcome,
      user.platformUserId,
      dto.verified ?? false,
      dto.evidenceUrl ?? null,
    );
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_PAYMENTS)
  @Throttle(PLATFORM_PAYMENT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post(":id/refund")
  async refund(
    @Param("id") id: string,
    @Body() dto: RefundPlatformPaymentDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<PaymentSummary> {
    return this.platformPaymentsService.refund(id, dto.reason, user.platformUserId);
  }
}
