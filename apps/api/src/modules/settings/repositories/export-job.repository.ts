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
}
