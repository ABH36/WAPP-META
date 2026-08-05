import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  Template,
  TemplateComponent,
  TemplateDocument,
  TemplateStatus,
} from "../schemas/template.schema.js";
import type { TemplateCategory } from "../schemas/template.schema.js";

export interface CreateTemplateInput {
  workspaceId: string;
  name: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponent[];
  createdBy: string;
}

@Injectable()
export class TemplateRepository {
  constructor(
    @InjectModel(Template.name) private readonly templateModel: Model<TemplateDocument>,
  ) {}

  async create(input: CreateTemplateInput): Promise<TemplateDocument> {
    return this.templateModel.create({ ...input, status: TemplateStatus.DRAFT });
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<TemplateDocument | null> {
    return this.templateModel.findOne({ _id: id, workspaceId, isDeleted: false }).exec();
  }

  async findByMetaTemplateId(
    workspaceId: string,
    metaTemplateId: string,
  ): Promise<TemplateDocument | null> {
    return this.templateModel.findOne({ workspaceId, metaTemplateId }).exec();
  }

  async findByWorkspace(workspaceId: string): Promise<TemplateDocument[]> {
    return this.templateModel
      .find({ workspaceId, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  async markSubmitted(id: string, metaTemplateId: string): Promise<TemplateDocument | null> {
    return this.templateModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { status: TemplateStatus.PENDING, metaTemplateId } },
        { new: true },
      )
      .exec();
  }

  /** Upserts a template synced from Meta by (workspaceId, metaTemplateId) — the sync path, not the create-locally path. */
  async upsertFromMetaSync(
    workspaceId: string,
    metaTemplateId: string,
    fields: {
      name: string;
      category: TemplateCategory;
      language: string;
      components: TemplateComponent[];
      status: TemplateStatus;
      rejectionReason: string | null;
      createdBy: string;
    },
  ): Promise<TemplateDocument> {
    return this.templateModel
      .findOneAndUpdate(
        { workspaceId, metaTemplateId },
        { $set: { workspaceId, metaTemplateId, ...fields } },
        { new: true, upsert: true },
      )
      .exec();
  }

  async updateStatus(
    id: string,
    status: TemplateStatus,
    rejectionReason: string | null = null,
  ): Promise<TemplateDocument | null> {
    return this.templateModel
      .findOneAndUpdate({ _id: id }, { $set: { status, rejectionReason } }, { new: true })
      .exec();
  }
}
