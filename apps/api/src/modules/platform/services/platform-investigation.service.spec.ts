import { Test } from "@nestjs/testing";
import { PlatformInvestigationService } from "./platform-investigation.service.js";
import { PlatformAuditService } from "./platform-audit.service.js";
import { AuditLogService } from "../../settings/services/audit-log.service.js";
import { BillingHistoryService } from "../../billing/services/billing-history.service.js";
import { AuthService } from "../../identity/services/auth.service.js";

describe("PlatformInvestigationService", () => {
  let service: PlatformInvestigationService;
  let platformAuditService: jest.Mocked<PlatformAuditService>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let billingHistoryService: jest.Mocked<BillingHistoryService>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformInvestigationService,
        { provide: PlatformAuditService, useValue: { listRecentForWorkspace: jest.fn() } },
        { provide: AuditLogService, useValue: { getAuditLogs: jest.fn() } },
        { provide: BillingHistoryService, useValue: { listRecentForWorkspace: jest.fn() } },
        { provide: AuthService, useValue: { getWorkspaceLoginHistory: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformInvestigationService);
    platformAuditService = moduleRef.get(PlatformAuditService);
    auditLogService = moduleRef.get(AuditLogService);
    billingHistoryService = moduleRef.get(BillingHistoryService);
    authService = moduleRef.get(AuthService);
  });

  it("merges all 4 sources into a single, occurredAt-descending timeline", async () => {
    platformAuditService.listRecentForWorkspace.mockResolvedValue([
      {
        id: "audit-1",
        eventType: "platform.support_session_started",
        description: "Support Session Started",
        workspaceId: "workspace-1",
        actorId: "op-1",
        metadata: {},
        occurredAt: "2026-08-10T03:00:00.000Z",
        createdAt: "2026-08-10T03:00:00.000Z",
      },
    ]);
    auditLogService.getAuditLogs.mockResolvedValue({
      items: [
        {
          id: "settings-1",
          category: "WORKSPACE" as never,
          actorId: "user-1",
          module: "Workspace",
          entity: null,
          entityId: null,
          action: "Workspace Updated",
          result: "SUCCESS" as never,
          ipAddress: null,
          userAgent: null,
          metadata: null,
          createdAt: "2026-08-10T01:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    billingHistoryService.listRecentForWorkspace.mockResolvedValue([
      {
        id: "billing-1",
        workspaceId: "workspace-1",
        eventType: "billing.invoice_paid",
        description: "Invoice Paid",
        metadata: {},
        occurredAt: "2026-08-10T02:00:00.000Z",
        createdAt: "2026-08-10T02:00:00.000Z",
      },
    ]);
    authService.getWorkspaceLoginHistory.mockResolvedValue([
      {
        id: "login-1",
        userId: "user-1",
        success: true,
        reason: null,
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        createdAt: "2026-08-10T04:00:00.000Z",
      },
    ]);

    const result = await service.getTimeline("workspace-1", 25);

    expect(auditLogService.getAuditLogs).toHaveBeenCalledWith("workspace-1", undefined, 1, 25);
    expect(result).toHaveLength(4);
    // Descending by occurredAt: login (04:00) > platform audit (03:00) > billing (02:00) > settings audit (01:00).
    expect(result.map((entry) => entry.source)).toEqual([
      "LOGIN_HISTORY",
      "PLATFORM_AUDIT",
      "BILLING_HISTORY",
      "SETTINGS_AUDIT",
    ]);
    expect(result.every((entry) => entry.workspaceId === "workspace-1")).toBe(true);
  });

  it("caps the merged result at the requested limit", async () => {
    platformAuditService.listRecentForWorkspace.mockResolvedValue([
      {
        id: "audit-1",
        eventType: "x",
        description: "x",
        workspaceId: "workspace-1",
        actorId: null,
        metadata: {},
        occurredAt: "2026-08-10T01:00:00.000Z",
        createdAt: "2026-08-10T01:00:00.000Z",
      },
      {
        id: "audit-2",
        eventType: "x",
        description: "x",
        workspaceId: "workspace-1",
        actorId: null,
        metadata: {},
        occurredAt: "2026-08-10T02:00:00.000Z",
        createdAt: "2026-08-10T02:00:00.000Z",
      },
    ]);
    auditLogService.getAuditLogs.mockResolvedValue({ items: [], total: 0, page: 1, limit: 1 });
    billingHistoryService.listRecentForWorkspace.mockResolvedValue([]);
    authService.getWorkspaceLoginHistory.mockResolvedValue([]);

    const result = await service.getTimeline("workspace-1", 1);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("audit-2");
  });
});
