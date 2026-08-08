import { Test } from "@nestjs/testing";
import { AuditLogService } from "./audit-log.service.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { AuthService } from "../../identity/services/auth.service.js";
import { AuditCategory, AuditResult } from "../schemas/audit-log-entry.schema.js";

describe("AuditLogService", () => {
  let service: AuditLogService;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: AuditLogRepository, useValue: { findByWorkspace: jest.fn() } },
        { provide: AuthService, useValue: { getWorkspaceLoginHistory: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AuditLogService);
    auditLogRepository = moduleRef.get(AuditLogRepository);
    authService = moduleRef.get(AuthService);
  });

  it("composes AUTHENTICATION entries from Identity's LoginHistory rather than AuditLogEntry", async () => {
    authService.getWorkspaceLoginHistory.mockResolvedValue([
      {
        id: "entry-1",
        userId: "user-1",
        success: false,
        reason: "INVALID_CREDENTIALS",
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        createdAt: "2026-08-08T00:00:00.000Z",
      },
    ]);

    const result = await service.getAuditLogs("workspace-1", AuditCategory.AUTHENTICATION, 1, 50);

    expect(auditLogRepository.findByWorkspace).not.toHaveBeenCalled();
    expect(authService.getWorkspaceLoginHistory).toHaveBeenCalledWith("workspace-1");
    expect(result.items).toEqual([
      {
        id: "entry-1",
        category: AuditCategory.AUTHENTICATION,
        actorId: "user-1",
        module: "Identity",
        entity: "LoginAttempt",
        entityId: null,
        action: "Login Failed",
        result: AuditResult.FAILURE,
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        metadata: { reason: "INVALID_CREDENTIALS" },
        createdAt: "2026-08-08T00:00:00.000Z",
      },
    ]);
  });

  it("queries AuditLogEntry directly for every other category", async () => {
    auditLogRepository.findByWorkspace.mockResolvedValue({
      items: [
        {
          _id: { toString: () => "log-1" },
          category: AuditCategory.CRM,
          actorId: "user-1",
          module: "CRM",
          entity: "Customer",
          entityId: "customer-1",
          action: "Customer Created",
          result: AuditResult.SUCCESS,
          ipAddress: null,
          userAgent: null,
          metadata: null,
          createdAt: new Date("2026-08-08T00:00:00.000Z"),
        } as never,
      ],
      total: 1,
    });

    const result = await service.getAuditLogs("workspace-1", AuditCategory.CRM, 1, 50);

    expect(authService.getWorkspaceLoginHistory).not.toHaveBeenCalled();
    expect(auditLogRepository.findByWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      { category: AuditCategory.CRM },
      1,
      50,
    );
    expect(result.items[0]?.action).toBe("Customer Created");
    expect(result.total).toBe(1);
  });
});
