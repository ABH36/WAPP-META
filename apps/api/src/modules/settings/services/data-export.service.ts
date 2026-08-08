import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ExportJobRepository } from "../repositories/export-job.repository.js";
import type { ExportJobDocument } from "../schemas/export-job.schema.js";
import { DATA_EXPORT_QUEUE } from "../queue/data-export.constants.js";
import type { CreateExportJobDto } from "../dto/create-export-job.dto.js";
import type { ExportJobSummary } from "../settings.types.js";

export interface DataExportJob {
  exportJobId: string;
  workspaceId: string;
}

function toExportJobSummary(job: ExportJobDocument): ExportJobSummary {
  return {
    id: job._id.toString(),
    entityType: job.entityType,
    format: job.format,
    status: job.status,
    resultUrl: job.resultUrl,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
  };
}

/** PRD-006 Volume-4 §4.3 — BR-006: async, never blocks the request. §10: max one active job per workspace. */
@Injectable()
export class DataExportService {
  constructor(
    private readonly exportJobRepository: ExportJobRepository,
    @InjectQueue(DATA_EXPORT_QUEUE) private readonly queue: Queue<DataExportJob>,
  ) {}

  async create(
    workspaceId: string,
    requestedBy: string,
    dto: CreateExportJobDto,
  ): Promise<ExportJobSummary> {
    const active = await this.exportJobRepository.findActiveByWorkspace(workspaceId);
    if (active) {
      throw new BadRequestException(
        "An export is already in progress for this workspace. Please wait for it to finish.",
      );
    }

    const job = await this.exportJobRepository.create({
      workspaceId,
      requestedBy,
      entityType: dto.entityType,
      format: dto.format,
    });

    await this.queue.add(
      "export",
      { exportJobId: job._id.toString(), workspaceId },
      { attempts: 1 },
    );

    return toExportJobSummary(job);
  }

  async getStatus(workspaceId: string, id: string): Promise<ExportJobSummary> {
    const job = await this.exportJobRepository.findByIdForWorkspace(workspaceId, id);
    if (!job) {
      throw new NotFoundException("Export job not found");
    }
    return toExportJobSummary(job);
  }
}
