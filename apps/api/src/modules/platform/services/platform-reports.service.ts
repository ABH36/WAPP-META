import { BadRequestException, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import ExcelJS from "exceljs";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { InvoiceService } from "../../billing/services/invoice.service.js";
import { SupportTicketRepository } from "../repositories/support-ticket.repository.js";
import { SupportSessionRepository } from "../repositories/support-session.repository.js";
import { PlatformAuditRepository } from "../repositories/platform-audit.repository.js";
import { PlatformComplianceService } from "./platform-compliance.service.js";
import {
  PlatformReportFormat,
  PlatformReportType,
  type PlatformReportsExportQueryDto,
  type PlatformReportsQueryDto,
} from "../dto/platform-reports-query.dto.js";
import {
  DomainEvent,
  type ComplianceReportExportedPayload,
} from "../../../common/events/domain-events.js";

const MAX_EXPORT_RANGE_DAYS = 365;
const REPORT_PAGE_SIZE = 500;

type ReportRow = Record<string, string | number>;

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/**
 * PRD-007 Volume-4 §4.2 — "Platform Administration orchestrates reports
 * and never duplicates report engines" (Architecture Review, 2026-08-10).
 * Every report type composes an already-existing, already-cross-tenant
 * Platform-side list method built in Volumes 1-3 (`WorkspaceRepository.
 * listAllForPlatform`, `InvoiceService.listAllForPlatform`,
 * `PlatformAuditRepository.list`, `SupportTicketRepository.list`,
 * `SupportSessionRepository.list`) — no cross-tenant aggregation logic is
 * written twice. CSV/Excel serialization is its own copy (third, after
 * Billing/CRM Reports) since Platform's row shapes are genuinely different
 * from either — same reasoning ADR-PLAT-004 used for SupportTicketCategory
 * being a new taxonomy, not a reused one. See
 * docs/ADR-PLAT-008-platform-analytics-strategy.md.
 */
@Injectable()
export class PlatformReportsService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly invoiceService: InvoiceService,
    private readonly supportTicketRepository: SupportTicketRepository,
    private readonly supportSessionRepository: SupportSessionRepository,
    private readonly platformAuditRepository: PlatformAuditRepository,
    private readonly platformComplianceService: PlatformComplianceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getReport(query: PlatformReportsQueryDto): Promise<ReportRow[]> {
    return this.getReportRows(query);
  }

  /** §10 — "Exports: Maximum date range 365 days." */
  async exportReport(query: PlatformReportsExportQueryDto, actorId: string): Promise<ExportResult> {
    if (query.from && query.to) {
      const days = (new Date(query.to).getTime() - new Date(query.from).getTime()) / 86_400_000;
      if (days < 0 || days > MAX_EXPORT_RANGE_DAYS) {
        throw new BadRequestException(`Date range must not exceed ${MAX_EXPORT_RANGE_DAYS} days`);
      }
    }

    const rows = await this.getReportRows(query);
    const baseName = `platform-${query.type.toLowerCase()}-report`;

    if (query.type === PlatformReportType.COMPLIANCE) {
      const payload: ComplianceReportExportedPayload = {
        format: query.format,
        actorId,
        occurredAt: new Date().toISOString(),
      };
      this.eventEmitter.emit(DomainEvent.COMPLIANCE_REPORT_EXPORTED, payload);
    }

    if (query.format === PlatformReportFormat.EXCEL) {
      const buffer = await this.toExcelBuffer(rows, query.type);
      return {
        buffer,
        filename: `${baseName}.xlsx`,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }

    return {
      buffer: Buffer.from(this.toCsv(rows), "utf-8"),
      filename: `${baseName}.csv`,
      contentType: "text/csv",
    };
  }

  private async getReportRows(query: PlatformReportsQueryDto): Promise<ReportRow[]> {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    switch (query.type) {
      case PlatformReportType.WORKSPACE:
        return this.workspaceReportRows();
      case PlatformReportType.BILLING:
        return this.billingReportRows();
      case PlatformReportType.PLATFORM_ACTIVITY:
        return this.platformActivityReportRows(from, to);
      case PlatformReportType.SUPPORT_OPERATIONS:
        return this.supportOperationsReportRows(from, to);
      case PlatformReportType.BREAK_GLASS:
        return this.breakGlassReportRows(from, to);
      case PlatformReportType.COMPLIANCE:
        return this.complianceReportRows();
    }
  }

  private async workspaceReportRows(): Promise<ReportRow[]> {
    const { items } = await this.workspaceRepository.listAllForPlatform({}, 1, REPORT_PAGE_SIZE);
    return items.map((workspace) => ({
      "Workspace ID": workspace._id.toString(),
      Name: workspace.name,
      Status: workspace.status,
      "Created At": workspace.createdAt.toISOString(),
    }));
  }

  private async billingReportRows(): Promise<ReportRow[]> {
    const { items } = await this.invoiceService.listAllForPlatform({}, 1, REPORT_PAGE_SIZE);
    return items.map((invoice) => ({
      "Invoice Number": invoice.invoiceNumber,
      "Workspace ID": invoice.workspaceId,
      Status: invoice.status,
      Amount: invoice.amount ?? "",
      "Due Date": invoice.dueDate,
      "Paid At": invoice.paidAt ?? "",
    }));
  }

  private async platformActivityReportRows(
    from: Date | null,
    to: Date | null,
  ): Promise<ReportRow[]> {
    const { items } = await this.platformAuditRepository.list({}, 1, REPORT_PAGE_SIZE);
    return items
      .filter((entry) => this.withinRange(entry.occurredAt, from, to))
      .map((entry) => ({
        "Event Type": entry.eventType,
        Description: entry.description,
        "Workspace ID": entry.workspaceId ?? "",
        "Actor ID": entry.actorId ?? "",
        "Occurred At": entry.occurredAt.toISOString(),
      }));
  }

  private async supportOperationsReportRows(
    from: Date | null,
    to: Date | null,
  ): Promise<ReportRow[]> {
    const tickets = await this.supportTicketRepository.list({});
    return tickets
      .filter((ticket) => this.withinRange(ticket.createdAt, from, to))
      .map((ticket) => ({
        "Workspace ID": ticket.workspaceId,
        Title: ticket.title,
        Category: ticket.category,
        Priority: ticket.priority,
        Status: ticket.status,
        "Created At": ticket.createdAt.toISOString(),
      }));
  }

  private async breakGlassReportRows(from: Date | null, to: Date | null): Promise<ReportRow[]> {
    const { items } = await this.supportSessionRepository.list({}, 1, REPORT_PAGE_SIZE);
    return items
      .filter((session) => this.withinRange(session.createdAt, from, to))
      .map((session) => ({
        "Workspace ID": session.workspaceId,
        Status: session.status,
        Reason: session.reason,
        "Duration (min)": session.durationMinutes,
        "Started At": session.startedAt ? session.startedAt.toISOString() : "",
        "Ended At": session.endedAt ? session.endedAt.toISOString() : "",
      }));
  }

  private async complianceReportRows(): Promise<ReportRow[]> {
    const snapshot = await this.platformComplianceService.getSnapshot();
    return [
      { Metric: "Break-Glass Sessions (Total)", Value: snapshot.breakGlassSessions.total },
      { Metric: "Break-Glass Sessions (Active)", Value: snapshot.breakGlassSessions.active },
      { Metric: "Platform Logins (Total)", Value: snapshot.platformLogins.total },
      { Metric: "Platform Logins (Successful)", Value: snapshot.platformLogins.successful },
      { Metric: "Failed Login Attempts", Value: snapshot.failedLoginAttempts },
      { Metric: "Permission Changes", Value: snapshot.permissionChanges },
      { Metric: "Audit Coverage (entries recorded)", Value: snapshot.auditCoverage },
      {
        Metric: "Workspaces With Retention Policy",
        Value: `${snapshot.dataRetentionStatus.workspacesWithPolicy}/${snapshot.dataRetentionStatus.totalWorkspaces}`,
      },
      ...Object.entries(snapshot.exportJobs).map(([status, count]) => ({
        Metric: `Export Jobs (${status})`,
        Value: count,
      })),
    ];
  }

  private withinRange(date: Date, from: Date | null, to: Date | null): boolean {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  private toCsv(rows: ReportRow[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]!);
    const escape = (value: string | number): string => {
      const str = String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escape(row[header] ?? "")).join(",")),
    ];
    return lines.join("\n");
  }

  private async toExcelBuffer(rows: ReportRow[], sheetName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]!);
      sheet.addRow(headers);
      for (const row of rows) {
        sheet.addRow(headers.map((header) => row[header] ?? ""));
      }
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as never);
  }
}
