import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException } from "@nestjs/common";
import { PlatformReportsService } from "./platform-reports.service.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { InvoiceService } from "../../billing/services/invoice.service.js";
import { SupportTicketRepository } from "../repositories/support-ticket.repository.js";
import { SupportSessionRepository } from "../repositories/support-session.repository.js";
import { PlatformAuditRepository } from "../repositories/platform-audit.repository.js";
import { PlatformComplianceService } from "./platform-compliance.service.js";
import { PlatformReportFormat, PlatformReportType } from "../dto/platform-reports-query.dto.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

function fakeWorkspace(): unknown {
  return {
    _id: { toString: () => "workspace-1" },
    name: "Acme",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

describe("PlatformReportsService", () => {
  let service: PlatformReportsService;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let invoiceService: jest.Mocked<InvoiceService>;
  let platformComplianceService: jest.Mocked<PlatformComplianceService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformReportsService,
        { provide: WorkspaceRepository, useValue: { listAllForPlatform: jest.fn() } },
        { provide: InvoiceService, useValue: { listAllForPlatform: jest.fn() } },
        { provide: SupportTicketRepository, useValue: { list: jest.fn() } },
        { provide: SupportSessionRepository, useValue: { list: jest.fn() } },
        { provide: PlatformAuditRepository, useValue: { list: jest.fn() } },
        { provide: PlatformComplianceService, useValue: { getSnapshot: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformReportsService);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    invoiceService = moduleRef.get(InvoiceService);
    platformComplianceService = moduleRef.get(PlatformComplianceService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("getReport", () => {
    it("composes WORKSPACE rows from the existing cross-tenant Workspace Registry list", async () => {
      workspaceRepository.listAllForPlatform.mockResolvedValue({
        items: [fakeWorkspace()] as never[],
        total: 1,
      });

      const rows = await service.getReport({ type: PlatformReportType.WORKSPACE });

      expect(rows).toHaveLength(1);
      expect(rows[0]?.Name).toBe("Acme");
      expect(workspaceRepository.listAllForPlatform).toHaveBeenCalledWith({}, 1, 500);
    });
  });

  describe("exportReport", () => {
    it("rejects a date range longer than 365 days", async () => {
      await expect(
        service.exportReport(
          {
            type: PlatformReportType.WORKSPACE,
            format: PlatformReportFormat.CSV,
            from: "2025-01-01T00:00:00.000Z",
            to: "2026-06-01T00:00:00.000Z",
          },
          "super-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("produces a CSV buffer for a WORKSPACE export", async () => {
      workspaceRepository.listAllForPlatform.mockResolvedValue({
        items: [fakeWorkspace()] as never[],
        total: 1,
      });

      const result = await service.exportReport(
        { type: PlatformReportType.WORKSPACE, format: PlatformReportFormat.CSV },
        "super-1",
      );

      expect(result.contentType).toBe("text/csv");
      expect(result.buffer.toString("utf-8")).toContain("Acme");
    });

    it("produces an Excel buffer for a WORKSPACE export", async () => {
      workspaceRepository.listAllForPlatform.mockResolvedValue({
        items: [fakeWorkspace()] as never[],
        total: 1,
      });

      const result = await service.exportReport(
        { type: PlatformReportType.WORKSPACE, format: PlatformReportFormat.EXCEL },
        "super-1",
      );

      expect(result.contentType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      expect(result.filename).toMatch(/\.xlsx$/);
    });

    it("emits COMPLIANCE_REPORT_EXPORTED only for a COMPLIANCE export", async () => {
      platformComplianceService.getSnapshot.mockResolvedValue({
        breakGlassSessions: { total: 0, active: 0 },
        platformLogins: { total: 0, successful: 0 },
        failedLoginAttempts: 0,
        permissionChanges: 0,
        auditCoverage: 0,
        dataRetentionStatus: { workspacesWithPolicy: 0, totalWorkspaces: 0 },
        exportJobs: {},
      });

      await service.exportReport(
        { type: PlatformReportType.COMPLIANCE, format: PlatformReportFormat.CSV },
        "super-1",
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.COMPLIANCE_REPORT_EXPORTED,
        expect.objectContaining({ format: PlatformReportFormat.CSV, actorId: "super-1" }),
      );
    });

    it("does not emit COMPLIANCE_REPORT_EXPORTED for a non-Compliance export", async () => {
      workspaceRepository.listAllForPlatform.mockResolvedValue({ items: [], total: 0 });

      await service.exportReport(
        { type: PlatformReportType.WORKSPACE, format: PlatformReportFormat.CSV },
        "super-1",
      );

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  it("composes BILLING rows from Invoice's existing platform-side list, not new aggregation", async () => {
    invoiceService.listAllForPlatform.mockResolvedValue({
      items: [
        {
          id: "invoice-1",
          workspaceId: "workspace-1",
          invoiceNumber: "INV-1",
          status: "ISSUED",
          amount: 999,
          dueDate: "2026-02-01T00:00:00.000Z",
          paidAt: null,
        } as never,
      ],
      total: 1,
    });

    const rows = await service.getReport({ type: PlatformReportType.BILLING });

    expect(rows[0]?.["Invoice Number"]).toBe("INV-1");
    expect(invoiceService.listAllForPlatform).toHaveBeenCalledWith({}, 1, 500);
  });
});
