import { Injectable } from "@nestjs/common";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { CustomerRepository } from "../../crm/repositories/customer.repository.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import { FeatureFlagRepository } from "../../settings/repositories/feature-flag.repository.js";
import { FeatureFlagKey } from "../../settings/schemas/feature-flag-state.schema.js";
import { SupportTicketRepository } from "../repositories/support-ticket.repository.js";
import { PlatformAuditRepository } from "../repositories/platform-audit.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { PlatformKpiSnapshot } from "../platform.types.js";

const ALL_FLAG_KEYS = Object.values(FeatureFlagKey);

/**
 * PRD-007 Volume-4 §4.5 — every KPI is calculated live at read time, never
 * persisted (BR-006). Two formulas were engineering judgment calls, made
 * during the architecture review and confirmed by the Architect's
 * approval — see docs/ADR-PLAT-008-platform-analytics-strategy.md:
 * `platformAvailability` is a derived proxy from existing Volume-3 audit
 * data (% of elapsed time outside a recorded Maintenance window), not true
 * infrastructure uptime, and is labeled as such via its own `note` field;
 * `featureAdoption` reuses Volume-1's `PlatformFeatureFlagOverride`
 * semantics via `FeatureFlagRepository.countEnabledAcrossWorkspaces`.
 */
@Injectable()
export class PlatformKpisService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly billingReportsService: BillingReportsService,
    private readonly featureFlagRepository: FeatureFlagRepository,
    private readonly supportTicketRepository: SupportTicketRepository,
    private readonly platformAuditRepository: PlatformAuditRepository,
  ) {}

  async getSnapshot(): Promise<PlatformKpiSnapshot> {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalWorkspaces,
      newWorkspacesThisMonth,
      totalCustomers,
      newCustomersThisMonth,
      currentMonthRevenue,
      previousMonthRevenue,
      supportResolutionTimeHours,
      platformAvailability,
      featureAdoption,
    ] = await Promise.all([
      this.workspaceRepository.countAll(),
      this.workspaceRepository.countCreatedSince(currentMonthStart),
      this.customerRepository.countAll(),
      this.customerRepository.countCreatedSince(currentMonthStart),
      this.billingReportsService.getPlatformRevenueInRange(currentMonthStart, now),
      this.billingReportsService.getPlatformRevenueInRange(previousMonthStart, currentMonthStart),
      this.supportTicketRepository.getAverageResolutionHours(),
      this.computePlatformAvailability(now),
      this.computeFeatureAdoption(),
    ]);

    return {
      workspaceGrowth: { newThisMonth: newWorkspacesThisMonth, totalWorkspaces },
      revenueGrowth: { currentMonth: currentMonthRevenue, previousMonth: previousMonthRevenue },
      customerGrowth: { newThisMonth: newCustomersThisMonth, totalCustomers },
      supportResolutionTimeHours,
      platformAvailability,
      featureAdoption,
    };
  }

  private async computePlatformAvailability(
    now: Date,
  ): Promise<{ percentageUptime: number; note: string }> {
    const note =
      "Application-level metric derived from recorded Platform Maintenance windows — not infrastructure uptime monitoring.";

    const events = await this.platformAuditRepository.findByEventTypesAscending([
      DomainEvent.PLATFORM_MAINTENANCE_ENABLED,
      DomainEvent.PLATFORM_MAINTENANCE_DISABLED,
    ]);

    if (events.length === 0) {
      return { percentageUptime: 100, note: `${note} No maintenance windows recorded yet.` };
    }

    const windowStart = events[0]!.occurredAt;
    let downtimeMs = 0;
    let enabledAt: Date | null = null;

    for (const event of events) {
      if (event.eventType === DomainEvent.PLATFORM_MAINTENANCE_ENABLED) {
        enabledAt = event.occurredAt;
      } else if (event.eventType === DomainEvent.PLATFORM_MAINTENANCE_DISABLED && enabledAt) {
        downtimeMs += event.occurredAt.getTime() - enabledAt.getTime();
        enabledAt = null;
      }
    }
    // Still in an unclosed maintenance window as of `now`.
    if (enabledAt) {
      downtimeMs += now.getTime() - enabledAt.getTime();
    }

    const totalElapsedMs = Math.max(now.getTime() - windowStart.getTime(), 1);
    const percentageUptime = Math.max(0, Math.min(100, 100 - (downtimeMs / totalElapsedMs) * 100));
    return { percentageUptime: Math.round(percentageUptime * 100) / 100, note };
  }

  private async computeFeatureAdoption(): Promise<
    Array<{ flagKey: string; adoptionPercentage: number }>
  > {
    const totalWorkspaces = await this.workspaceRepository.countAll();
    if (totalWorkspaces === 0) {
      return ALL_FLAG_KEYS.map((flagKey) => ({ flagKey, adoptionPercentage: 0 }));
    }

    const counts = await Promise.all(
      ALL_FLAG_KEYS.map((flagKey) =>
        this.featureFlagRepository.countEnabledAcrossWorkspaces(flagKey, totalWorkspaces),
      ),
    );

    return ALL_FLAG_KEYS.map((flagKey, index) => ({
      flagKey,
      adoptionPercentage: Math.round(((counts[index] ?? 0) / totalWorkspaces) * 10000) / 100,
    }));
  }
}
