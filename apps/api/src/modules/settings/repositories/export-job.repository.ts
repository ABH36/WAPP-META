import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  ExportEntityType,
  ExportFormat,
  ExportJob,
  ExportJobDocument,
  ExportJobStatus,
} from "../schemas/export-job.schema.js";

export interface CreateExportJobInput {
  workspaceId: string;
  requestedBy: string;
  entityType: ExportEntityType;
  format: ExportFormat;
}

@Injectable()
export class ExportJobRepository {
  constructor(
    @InjectModel(ExportJob.name) private readonly exportJobModel: Model<ExportJobDocument>,
  ) {}

  async create(input: CreateExportJobInput): Promise<ExportJobDocument> {
    return this.exportJobModel.create(input);
  }

  /** §10 — max one active (PENDING/PROCESSING) export job per workspace. */
  async findActiveByWorkspace(workspaceId: string): Promise<ExportJobDocument | null> {
    return this.exportJobModel
      .findOne({
        workspaceId,
        status: { $in: [ExportJobStatus.PENDING, ExportJobStatus.PROCESSING] },
      })
      .exec();
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<ExportJobDocument | null> {
    return this.exportJobModel.findOne({ _id: id, workspaceId }).exec();
  }

  async markProcessing(id: string): Promise<void> {
    await this.exportJobModel
      .updateOne({ _id: id }, { $set: { status: ExportJobStatus.PROCESSING } })
      .exec();
  }

  async markCompleted(id: string, resultUrl: string): Promise<void> {
    await this.exportJobModel
      .updateOne({ _id: id }, { $set: { status: ExportJobStatus.COMPLETED, resultUrl } })
      .exec();
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.exportJobModel
      .updateOne({ _id: id }, { $set: { status: ExportJobStatus.FAILED, error } })
      .exec();
  }

  /** PRD-007 Volume-4 §4.4 (Compliance Dashboard, "Export Jobs") — cross-tenant, the one deliberate exception to this repository's otherwise workspace-scoped methods. */
  async countByStatusAcrossWorkspaces(): Promise<Record<ExportJobStatus, number>> {
    const rows = await this.exportJobModel
      .aggregate<{ _id: ExportJobStatus; count: number }>([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .exec();
    const byStatus = Object.fromEntries(
      Object.values(ExportJobStatus).map((status) => [status, 0]),
    ) as Record<ExportJobStatus, number>;
    for (const row of rows) {
      byStatus[row._id] = row.count;
    }
    return byStatus;
  }
}
