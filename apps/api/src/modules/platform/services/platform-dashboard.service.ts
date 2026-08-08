import { Injectable } from "@nestjs/common";
import { WorkspaceStatus } from "@wapp/shared-types";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { LeadRepository } from "../../crm/repositories/lead.repository.js";
import { DealRepository } from "../../crm/repositories/deal.repository.js";
import { MessageRepository } from "../../communication/repositories/message.repository.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import { HealthCheckService, type HealthChecks } from "../../../health/health-check.service.js";

export interface PlatformDashboardSnapshot {
  workspaces: {
    total: number;
    byStatus: Record<WorkspaceStatus, number>;
  };
  totalUsers: number;
  totalLeads: number;
  totalDeals: number;
  totalMessages: number;
  /** Sum of actual paid Payments across every workspace — always a real number, not derived from unset Plan pricing (TD-009/TD-011 affects invoice amounts, not recorded payments). */
  totalRevenue: number;
  systemHealth: HealthChecks;
}

const ALL_STATUSES = Object.values(WorkspaceStatus);

/**
 * PRD-007 Volume-1 §4.2 — live cross-tenant aggregation at read time,
 * nothing persisted (matches the CRM/Billing Reports pattern, not the
 * Billing Usage-counter pattern — dashboard metrics are current-state
 * snapshots). See docs/ADR-PLAT-001-platform-administration-boundary.md.
 */
@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
    private readonly leadRepository: LeadRepository,
    private readonly dealRepository: DealRepository,
    private readonly messageRepository: MessageRepository,
    private readonly billingReportsService: BillingReportsService,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  async getSnapshot(): Promise<PlatformDashboardSnapshot> {
    const [
      total,
      byStatusCounts,
      totalUsers,
      totalLeads,
      totalDeals,
      totalMessages,
      totalRevenue,
      systemHealth,
    ] = await Promise.all([
      this.workspaceRepository.countAll(),
      Promise.all(ALL_STATUSES.map((status) => this.workspaceRepository.countByStatus(status))),
      this.userRepository.countAll(),
      this.leadRepository.countAll(),
      this.dealRepository.countAll(),
      this.messageRepository.countAll(),
      this.billingReportsService.getPlatformRevenueTotal(),
      this.healthCheckService.getChecks(),
    ]);

    const byStatus = ALL_STATUSES.reduce(
      (acc, status, index) => {
        acc[status] = byStatusCounts[index] ?? 0;
        return acc;
      },
      {} as Record<WorkspaceStatus, number>,
    );

    return {
      workspaces: { total, byStatus },
      totalUsers,
      totalLeads,
      totalDeals,
      totalMessages,
      totalRevenue,
      systemHealth,
    };
  }
}
