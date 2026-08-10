import { Injectable } from "@nestjs/common";
import { WorkspaceStatus } from "@wapp/shared-types";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { LeadRepository } from "../../crm/repositories/lead.repository.js";
import { DealRepository } from "../../crm/repositories/deal.repository.js";
import { CustomerRepository } from "../../crm/repositories/customer.repository.js";
import { MessageRepository } from "../../communication/repositories/message.repository.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformSessionRepository } from "../repositories/platform-session.repository.js";
import type { PlatformAnalyticsSnapshot } from "../platform.types.js";

/**
 * PRD-007 Volume-4 §4.1 — live cross-tenant aggregation only (§11 — "No
 * materialized reporting tables"), extending the exact same repository
 * methods Volume-1's `PlatformDashboardService` already established
 * (`WorkspaceRepository.countAll/countByStatus`, `MessageRepository.countAll`,
 * `BillingReportsService.getPlatformRevenueTotal`) rather than duplicating
 * that aggregation logic a second time. Volume-1's `/platform/dashboard`
 * and this `/platform/analytics` deliberately coexist — the former is
 * Volume-1's original operational at-a-glance view (frozen, untouched),
 * this is Volume-4's fuller cross-tenant analytics view (Platform Users,
 * Active Sessions, CRM Growth, Revenue Summary). Storage Usage/API Usage
 * from §4.1's original list are deliberately excluded — Architecture
 * Review, 2026-08-10, consistent with TD-013's existing commercial
 * deferral. See docs/ADR-PLAT-008-platform-analytics-strategy.md.
 */
@Injectable()
export class PlatformAnalyticsService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly leadRepository: LeadRepository,
    private readonly dealRepository: DealRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly messageRepository: MessageRepository,
    private readonly billingReportsService: BillingReportsService,
    private readonly platformUserRepository: PlatformUserRepository,
    private readonly platformSessionRepository: PlatformSessionRepository,
  ) {}

  async getSnapshot(): Promise<PlatformAnalyticsSnapshot> {
    const [
      totalWorkspaces,
      activeWorkspaces,
      archivedWorkspaces,
      platformUsers,
      activePlatformSessions,
      messagesProcessed,
      totalLeads,
      totalDeals,
      totalCustomers,
      totalRevenue,
    ] = await Promise.all([
      this.workspaceRepository.countAll(),
      this.workspaceRepository.countByStatus(WorkspaceStatus.ACTIVE),
      this.workspaceRepository.countByStatus(WorkspaceStatus.ARCHIVED),
      this.platformUserRepository.countAll(),
      this.platformSessionRepository.countActive(),
      this.messageRepository.countAll(),
      this.leadRepository.countAll(),
      this.dealRepository.countAll(),
      this.customerRepository.countAll(),
      this.billingReportsService.getPlatformRevenueTotal(),
    ]);

    return {
      totalWorkspaces,
      activeWorkspaces,
      archivedWorkspaces,
      platformUsers,
      activePlatformSessions,
      messagesProcessed,
      crmGrowth: { totalLeads, totalDeals, totalCustomers },
      revenueSummary: { totalRevenue },
    };
  }
}
