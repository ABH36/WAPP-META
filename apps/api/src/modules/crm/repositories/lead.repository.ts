import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import { LeadSource, LeadStatus } from "@wapp/shared-types";
import { Lead, LeadDocument } from "../schemas/lead.schema.js";
import { LEAD_ACTIVE_STATUSES } from "../crm.constants.js";

export interface CreateLeadInput {
  workspaceId: string;
  contactId: string;
  customerId: string | null;
  leadName: string;
  mobileNumber: string;
  source: LeadSource;
  company: string | null;
  email: string | null;
  industry: string | null;
  expectedValue: number | null;
  notes: string | null;
  createdBy: string;
}

export interface UpdateLeadInput {
  leadName?: string;
  company?: string | null;
  email?: string | null;
  industry?: string | null;
  expectedValue?: number | null;
  notes?: string | null;
}

export interface ListLeadsFilter {
  status?: LeadStatus;
  source?: LeadSource;
  assignedUserId?: string;
  q?: string;
}

/** §15 — the sortable fields Volume-2 Part-2 supports. "Last Activity" is deferred, same TD-006 reasoning as Customer's "Last Conversation" (needs a cross-module lookup). */
export type LeadSortField = "leadName" | "createdAt" | "updatedAt" | "expectedValue";

export interface ListLeadsResult {
  items: LeadDocument[];
  total: number;
}

const SORT_FIELD_MAP: Record<LeadSortField, string> = {
  leadName: "leadName",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  expectedValue: "expectedValue",
};

@Injectable()
export class LeadRepository {
  constructor(@InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>) {}

  async create(input: CreateLeadInput): Promise<LeadDocument> {
    return this.leadModel.create({
      ...input,
      status: LeadStatus.NEW,
      assignedUserId: null,
      archivedAt: null,
      updatedBy: input.createdBy,
    });
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<LeadDocument | null> {
    return this.leadModel.findOne({ _id: id, workspaceId }).exec();
  }

  /** BR-005/§11 dedup check — mirrors the schema's own partial unique index. */
  async findActiveByContactForWorkspace(
    workspaceId: string,
    contactId: string,
  ): Promise<LeadDocument | null> {
    return this.leadModel
      .findOne({ workspaceId, contactId, status: { $in: LEAD_ACTIVE_STATUSES }, archivedAt: null })
      .exec();
  }

  async list(
    workspaceId: string,
    filter: ListLeadsFilter,
    sortBy: LeadSortField,
    sortOrder: 1 | -1,
    page: number,
    limit: number,
  ): Promise<ListLeadsResult> {
    const query: FilterQuery<LeadDocument> = { workspaceId };
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.source) {
      query.source = filter.source;
    }
    if (filter.assignedUserId) {
      query.assignedUserId = filter.assignedUserId;
    }
    if (filter.q) {
      // §13 — Lead Name, Mobile Number, Company, Email.
      const pattern = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { leadName: pattern },
        { mobileNumber: pattern },
        { company: pattern },
        { email: pattern },
      ];
    }

    const [items, total] = await Promise.all([
      this.leadModel
        .find(query)
        .sort({ [SORT_FIELD_MAP[sortBy]]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.leadModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async update(
    workspaceId: string,
    id: string,
    input: UpdateLeadInput,
    updatedBy: string,
  ): Promise<LeadDocument | null> {
    return this.leadModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: { ...input, updatedBy } }, { new: true })
      .exec();
  }

  async updateAssignment(
    workspaceId: string,
    id: string,
    assignedUserId: string | null,
    updatedBy: string,
  ): Promise<LeadDocument | null> {
    return this.leadModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { assignedUserId, updatedBy } },
        { new: true },
      )
      .exec();
  }

  async updateStatus(
    workspaceId: string,
    id: string,
    status: LeadStatus,
    updatedBy: string,
  ): Promise<LeadDocument | null> {
    return this.leadModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: { status, updatedBy } }, { new: true })
      .exec();
  }

  async archive(workspaceId: string, id: string, updatedBy: string): Promise<LeadDocument | null> {
    return this.leadModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { archivedAt: new Date(), updatedBy } },
        { new: true },
      )
      .exec();
  }
}
