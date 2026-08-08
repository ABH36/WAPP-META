import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { PlatformMaintenanceGateRepository } from "../repositories/platform-maintenance-gate.repository.js";

/** PRD-007 Volume-1 §4.7 — keeps Identity's global login-gate read model in sync with Platform Administration's platform-wide Maintenance toggle. */
@Injectable()
export class PlatformMaintenanceGateListener {
  constructor(
    private readonly platformMaintenanceGateRepository: PlatformMaintenanceGateRepository,
  ) {}

  @OnEvent(DomainEvent.PLATFORM_MAINTENANCE_ENABLED)
  async onEnabled(): Promise<void> {
    await this.platformMaintenanceGateRepository.setEnabled(true);
  }

  @OnEvent(DomainEvent.PLATFORM_MAINTENANCE_DISABLED)
  async onDisabled(): Promise<void> {
    await this.platformMaintenanceGateRepository.setEnabled(false);
  }
}
