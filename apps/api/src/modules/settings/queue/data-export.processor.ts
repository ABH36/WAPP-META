import { Injectable, Logger } from "@nestjs/common";
import { Processor } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import ExcelJS from "exceljs";
import { ObservableProcessor } from "../../../common/observability/observable-processor.base.js";
import { CorrelationContextService } from "../../../common/observability/correlation-context.service.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";
import { ReportsService } from "../../crm/services/reports.service.js";
import {
  ExportFormat as CrmExportFormat,
  ExportReportType,
} from "../../crm/dto/export-report.dto.js";
import { CustomerRepository } from "../../crm/repositories/customer.repository.js";
import type { CustomerDocument } from "../../crm/schemas/customer.schema.js";
import { BillingReportsService } from "../../billing/services/billing-reports.service.js";
import {
  ExportBillingReportType,
  ExportFormat as BillingExportFormat,
} from "../../billing/dto/export-billing-report.dto.js";
import { ExportJobRepository } from "../repositories/export-job.repository.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { FeatureFlagRepository } from "../repositories/feature-flag.repository.js";
import { RetentionPolicyRepository } from "../repositories/retention-policy.repository.js";
import { StorageService } from "../../../infrastructure/storage/storage.service.js";
import { ExportEntityType, ExportFormat } from "../schemas/export-job.schema.js";
import { DATA_EXPORT_QUEUE } from "./data-export.constants.js";
import type { DataExportJob } from "../services/data-export.service.js";

type ReportRow = Record<string, string | number>;

interface BuiltExport {
  buffer: Buffer;
  extension: string;
  contentType: string;
}

const EXPORT_FOLDER_PREFIX = "exports";

/**
 * PRD-006 Volume-4 §4.3 — off the request path (BR-006). LEADS/DEALS/
 * ACTIVITIES/BILLING reuse CRM's/Billing's own existing `exportReport()`
 * rather than re-implementing report generation (§11 — Settings never
 * owns CRM/Billing data); CUSTOMERS/SETTINGS are built directly here since
 * neither has an equivalent existing export. JSON format is only
 * supported for CUSTOMERS/SETTINGS — CRM/Billing's export methods only
 * ever produce CSV/Excel, so a JSON request for those entity types fails
 * the job with a clear error rather than silently mis-formatting. See
 * docs/ADR-SET-007-audit-strategy.md.
 */
@Injectable()
@Processor(DATA_EXPORT_QUEUE)
export class DataExportProcessor extends ObservableProcessor<DataExportJob> {
  protected readonly logger = new Logger(DataExportProcessor.name);
  protected readonly queueName = DATA_EXPORT_QUEUE;

  constructor(
    private readonly exportJobRepository: ExportJobRepository,
    private readonly reportsService: ReportsService,
    private readonly customerRepository: CustomerRepository,
    private readonly billingReportsService: BillingReportsService,
    private readonly workspaceSettingsRepository: WorkspaceSettingsRepository,
    private readonly featureFlagRepository: FeatureFlagRepository,
    private readonly retentionPolicyRepository: RetentionPolicyRepository,
    private readonly storageService: StorageService,
    correlationContext: CorrelationContextService,
    metricsService: MetricsService,
  ) {
    super(correlationContext, metricsService);
  }

  protected async handle(job: Job<DataExportJob>): Promise<void> {
    const { exportJobId, workspaceId } = job.data;
    const exportJob = await this.exportJobRepository.findByIdForWorkspace(workspaceId, exportJobId);
    if (!exportJob) {
      return;
    }

    await this.exportJobRepository.markProcessing(exportJobId);

    try {
      const built = await this.build(workspaceId, exportJob.entityType, exportJob.format);
      const filename = `${exportJob.entityType.toLowerCase()}-${exportJobId}.${built.extension}`;
      const { url } = await this.storageService.uploadBuffer(
        built.buffer,
        `${EXPORT_FOLDER_PREFIX}/${workspaceId}`,
        filename,
      );
      await this.exportJobRepository.markCompleted(exportJobId, url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export error";
      this.logger.error(`Data export failed for job ${exportJobId}: ${message}`);
      await this.exportJobRepository.markFailed(exportJobId, message);
    }
  }

  private async build(
    workspaceId: string,
    entityType: ExportEntityType,
    format: ExportFormat,
  ): Promise<BuiltExport> {
    switch (entityType) {
      case ExportEntityType.LEADS:
        return this.viaCrmReport(workspaceId, ExportReportType.LEADS, format);
      case ExportEntityType.DEALS:
        return this.viaCrmReport(workspaceId, ExportReportType.DEALS, format);
      case ExportEntityType.ACTIVITIES:
        return this.viaCrmReport(workspaceId, ExportReportType.ACTIVITIES, format);
      case ExportEntityType.BILLING:
        return this.viaBillingReport(workspaceId, format);
      case ExportEntityType.CUSTOMERS:
        return this.buildCustomersExport(workspaceId, format);
      case ExportEntityType.SETTINGS:
        return this.buildSettingsExport(workspaceId, format);
    }
  }

  private async viaCrmReport(
    workspaceId: string,
    type: ExportReportType,
    format: ExportFormat,
  ): Promise<BuiltExport> {
    const crmFormat = this.toCrmFormat(format);
    const result = await this.reportsService.exportReport(workspaceId, {
      type,
      format: crmFormat,
    });
    return {
      buffer: result.buffer,
      extension: crmFormat === CrmExportFormat.EXCEL ? "xlsx" : "csv",
      contentType: result.contentType,
    };
  }

  private async viaBillingReport(workspaceId: string, format: ExportFormat): Promise<BuiltExport> {
    const billingFormat = this.toBillingFormat(format);
    const result = await this.billingReportsService.exportReport(workspaceId, {
      type: ExportBillingReportType.INVOICES,
      format: billingFormat,
    });
    return {
      buffer: result.buffer,
      extension: billingFormat === BillingExportFormat.EXCEL ? "xlsx" : "csv",
      contentType: result.contentType,
    };
  }

  private async buildCustomersExport(
    workspaceId: string,
    format: ExportFormat,
  ): Promise<BuiltExport> {
    const customers = await this.customerRepository.findAllForWorkspace(workspaceId);
    const rows = this.customersToRows(customers);
    return this.rowsToExport(rows, format, "Customers");
  }

  private async buildSettingsExport(
    workspaceId: string,
    format: ExportFormat,
  ): Promise<BuiltExport> {
    const [settings, flags, retention] = await Promise.all([
      this.workspaceSettingsRepository.getOrCreate(workspaceId),
      this.featureFlagRepository.findByWorkspace(workspaceId),
      this.retentionPolicyRepository.getOrCreate(workspaceId),
    ]);

    if (format === ExportFormat.JSON) {
      const payload = {
        settings: {
          currency: settings.currency,
          dateFormat: settings.dateFormat,
          timeFormat: settings.timeFormat,
          logoUrl: settings.logoUrl,
        },
        featureFlags: flags.map((flag) => ({ flagKey: flag.flagKey, enabled: flag.enabled })),
        retentionPolicy: {
          auditLogRetentionDays: retention.auditLogRetentionDays,
          loginHistoryRetentionDays: retention.loginHistoryRetentionDays,
          notificationHistoryRetentionDays: retention.notificationHistoryRetentionDays,
          webhookDeliveryLogRetentionDays: retention.webhookDeliveryLogRetentionDays,
        },
      };
      return {
        buffer: Buffer.from(JSON.stringify(payload, null, 2), "utf-8"),
        extension: "json",
        contentType: "application/json",
      };
    }

    const rows: ReportRow[] = [
      { Key: "currency", Value: settings.currency },
      { Key: "dateFormat", Value: settings.dateFormat },
      { Key: "timeFormat", Value: settings.timeFormat },
      { Key: "logoUrl", Value: settings.logoUrl ?? "" },
      ...flags.map((flag): ReportRow => ({
        Key: `featureFlag.${flag.flagKey}`,
        Value: String(flag.enabled),
      })),
      { Key: "retention.auditLogDays", Value: retention.auditLogRetentionDays },
      { Key: "retention.loginHistoryDays", Value: retention.loginHistoryRetentionDays },
      {
        Key: "retention.notificationHistoryDays",
        Value: retention.notificationHistoryRetentionDays,
      },
      { Key: "retention.webhookDeliveryLogDays", Value: retention.webhookDeliveryLogRetentionDays },
    ];
    return this.rowsToExport(rows, format, "Settings");
  }

  private customersToRows(customers: CustomerDocument[]): ReportRow[] {
    return customers.map((customer) => ({
      "Customer Name": customer.customerName,
      "Mobile Number": customer.mobileNumber,
      "Company Name": customer.companyName ?? "",
      Email: customer.email ?? "",
      Status: customer.status,
      Source: customer.source,
      "Created At": customer.createdAt.toISOString(),
    }));
  }

  private async rowsToExport(
    rows: ReportRow[],
    format: ExportFormat,
    sheetName: string,
  ): Promise<BuiltExport> {
    if (format === ExportFormat.JSON) {
      return {
        buffer: Buffer.from(JSON.stringify(rows, null, 2), "utf-8"),
        extension: "json",
        contentType: "application/json",
      };
    }
    if (format === ExportFormat.EXCEL) {
      return {
        buffer: await this.toExcelBuffer(rows, sheetName),
        extension: "xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }
    return {
      buffer: Buffer.from(this.toCsv(rows), "utf-8"),
      extension: "csv",
      contentType: "text/csv",
    };
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

  /** CRM's export only ever produces CSV/Excel — JSON isn't a supported target for a reused report, so it fails clearly instead of silently mis-formatting. */
  private toCrmFormat(format: ExportFormat): CrmExportFormat {
    if (format === ExportFormat.JSON) {
      throw new Error("JSON format is not supported for this entity type — use CSV or Excel");
    }
    return format === ExportFormat.EXCEL ? CrmExportFormat.EXCEL : CrmExportFormat.CSV;
  }

  private toBillingFormat(format: ExportFormat): BillingExportFormat {
    if (format === ExportFormat.JSON) {
      throw new Error("JSON format is not supported for this entity type — use CSV or Excel");
    }
    return format === ExportFormat.EXCEL ? BillingExportFormat.EXCEL : BillingExportFormat.CSV;
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
    return Buffer.from(buffer);
  }
}
