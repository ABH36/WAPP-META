import { Test } from "@nestjs/testing";
import { PlatformAuditListener } from "./platform-audit.listener.js";
import { PlatformAuditService } from "../services/platform-audit.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

describe("PlatformAuditListener", () => {
  let listener: PlatformAuditListener;
  let platformAuditService: jest.Mocked<PlatformAuditService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAuditListener,
        { provide: PlatformAuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(PlatformAuditListener);
    platformAuditService = moduleRef.get(PlatformAuditService);
  });

  it("records BREAK_GLASS_REQUESTED with the reason in the description", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onBreakGlassRequested({
      workspaceId: "workspace-1",
      sessionId: "session-1",
      reason: "Investigating a billing discrepancy",
      durationMinutes: 60,
      actorId: "op-1",
      occurredAt,
    });

    expect(platformAuditService.record).toHaveBeenCalledWith(
      DomainEvent.BREAK_GLASS_REQUESTED,
      expect.stringContaining("Investigating a billing discrepancy"),
      "workspace-1",
      "op-1",
      expect.anything(),
      new Date(occurredAt),
    );
  });

  it("records SUPPORT_SESSION_STARTED", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onSupportSessionStarted({
      workspaceId: "workspace-1",
      sessionId: "session-1",
      expiresAt: occurredAt,
      actorId: "super-1",
      occurredAt,
    });

    expect(platformAuditService.record).toHaveBeenCalledWith(
      DomainEvent.SUPPORT_SESSION_STARTED,
      "Support Session Started",
      "workspace-1",
      "super-1",
      expect.anything(),
      new Date(occurredAt),
    );
  });

  it("records SUPPORT_SESSION_EXPIRED with actorId 'system'", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onSupportSessionExpired({
      workspaceId: "workspace-1",
      sessionId: "session-1",
      actorId: "system",
      occurredAt,
    });

    expect(platformAuditService.record).toHaveBeenCalledWith(
      DomainEvent.SUPPORT_SESSION_EXPIRED,
      "Support Session Expired",
      "workspace-1",
      "system",
      expect.anything(),
      new Date(occurredAt),
    );
  });

  it("records PLATFORM_FEATURE_UPDATED with a null workspaceId (genuinely platform-wide, closing the Volume-1 audit gap)", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onPlatformFeatureUpdated({
      flagKey: "AI_ASSISTANT",
      enabled: true,
      actorId: "super-1",
      occurredAt,
    });

    expect(platformAuditService.record).toHaveBeenCalledWith(
      DomainEvent.PLATFORM_FEATURE_UPDATED,
      expect.stringContaining("AI_ASSISTANT"),
      null,
      "super-1",
      expect.anything(),
      new Date(occurredAt),
    );
  });

  it("records PLATFORM_MAINTENANCE_ENABLED with a null workspaceId", async () => {
    const occurredAt = new Date().toISOString();
    await listener.onPlatformMaintenanceEnabled({ actorId: "super-1", occurredAt });

    expect(platformAuditService.record).toHaveBeenCalledWith(
      DomainEvent.PLATFORM_MAINTENANCE_ENABLED,
      "Platform Maintenance Enabled",
      null,
      "super-1",
      expect.anything(),
      new Date(occurredAt),
    );
  });
});
