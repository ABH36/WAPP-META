import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ExportJobDocument = HydratedDocument<ExportJob>;

/** §4.3 — Customers/Leads/Deals/Activities/Billing/Settings. */
export enum ExportEntityType {
  CUSTOMERS = "CUSTOMERS",
  LEADS = "LEADS",
  DEALS = "DEALS",
  ACTIVITIES = "ACTIVITIES",
  BILLING = "BILLING",
  SETTINGS = "SETTINGS",
}

export enum ExportFormat {
  CSV = "CSV",
  EXCEL = "EXCEL",
  JSON = "JSON",
}

export enum ExportJobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/**
 * PRD-006 Volume-4 §4.3 — asynchronous (BR-006: "never blocks normal
 * application usage"). Settings owns the job/queue; the actual row
 * generation for LEADS/DEALS/ACTIVITIES reuses CRM's existing
 * `ReportsService.exportReport()`, BILLING reuses Billing's
 * `BillingReportsService.exportReport()`, CUSTOMERS/SETTINGS are built
 * directly here — never a second copy of business-report logic. See
 * docs/ADR-SET-007-audit-strategy.md. §10 — max one active
 * (PENDING/PROCESSING) job per workspace, enforced in
 * `DataExportService.create()`.
 */
@Schema({ timestamps: true, collection: "export_jobs" })
export class ExportJob {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  @Prop({ type: String, required: true })
  requestedBy!: string;

  @Prop({ type: String, enum: ExportEntityType, required: true })
  entityType!: ExportEntityType;

  @Prop({ type: String, enum: ExportFormat, required: true })
  format!: ExportFormat;

  @Prop({ type: String, enum: ExportJobStatus, required: true, default: ExportJobStatus.PENDING })
  status!: ExportJobStatus;

  @Prop({ type: String, default: null })
  resultUrl!: string | null;

  @Prop({ type: String, default: null })
  error!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ExportJobSchema = SchemaFactory.createForClass(ExportJob);
