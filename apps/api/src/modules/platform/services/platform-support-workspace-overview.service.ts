import { Injectable, NotFoundException } from "@nestjs/common";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { toMemberSummary } from "../../workspace/mappers/workspace.mapper.js";
import { SubscriptionService } from "../../billing/services/subscription.service.js";
import { InvoiceService } from "../../billing/services/invoice.service.js";
import { SettingsService } from "../../settings/services/settings.service.js";
import { toPlatformWorkspaceSummary } from "../mappers/platform.mapper.js";
import type { SupportWorkspaceOverview } from "../platform.types.js";

/**
 * PRD-007 Volume-3 §4.7 — Cross-Tenant Read Access. Every field here is
 * assembled from an already-existing, already-cross-tenant-capable (or,
 * for Settings, newly-exported) tenant-facing service — no new data-access
 * code, no duplicate persistence (§11/BR-006). Callers must already have
 * passed `SupportSessionGuard` — this service itself performs no
 * authorization check, only composition.
 */
@Injectable()
export class PlatformSupportWorkspaceOverviewService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
    private readonly settingsService: SettingsService,
  ) {}

  async getOverview(workspaceId: string): Promise<SupportWorkspaceOverview> {
    const workspaceDoc = await this.workspaceRepository.findById(workspaceId);
    if (!workspaceDoc) {
      throw new NotFoundException("Workspace not found");
    }

    const [members, subscription, invoices, settingsOverview] = await Promise.all([
      this.userRepository.findWorkspaceMembers(workspaceId),
      this.subscriptionService.getForWorkspace(workspaceId),
      this.invoiceService.list(workspaceId),
      this.settingsService.getOverview(workspaceId),
    ]);

    return {
      workspace: toPlatformWorkspaceSummary(workspaceDoc),
      users: members.map(toMemberSummary),
      subscription,
      invoices,
      settingsOverview,
    };
  }
}
