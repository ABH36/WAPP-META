import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, FilterQuery, Model } from "mongoose";
import { DealLostReason, DealStage } from "@wapp/shared-types";
import { Deal, DealDocument } from "../schemas/deal.schema.js";

export interface CreateDealInput {
  workspaceId: string;
  contactId: string;
  customerId: string;
  sourceLeadId: string;
  title: string;
  assignedTo: string | null;
  createdBy: string;
}

export interface UpdateDealInput {
  title?: string;
  description?: string | null;
  value?: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: Date | null;
}

export interface ListDealsFilter {
  stage?: DealStage;
  assignedTo?: string;
  customerId?: string;
  expectedCloseFrom?: Date;
  expectedCloseTo?: Date;
  /** §12 — free-text search across Title/Customer/Contact. */
  q?: string;
}

/** §14 — the sortable fields Volume-4 supports. */
export type DealSortField =
  "createdAt" | "updatedAt" | "value" | "probability" | "expectedCloseDate" | "title";

export interface ListDealsResult {
  items: DealDocument[];
  total: number;
}

const SORT_FIELD_MAP: Record<DealSortField, string> = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  value: "value",
  probability: "probability",
  expectedCloseDate: "expectedCloseDate",
  title: "title",
};

/**
 * PRD-004 Volume-3 §7 (minimal conversion-only `create`, still the only
 * creation path — ADR-CRM-010) plus PRD-004 Volume-4 (the full
 * query/update/pipeline surface, owned from here on) — see
 * docs/ADR-CRM-012-deal-lifecycle-strategy.md.
 */
@Injectable()
export class DealRepository {
  constructor(@InjectModel(Deal.name) private readonly dealModel: Model<DealDocument>) {}

  /** Always called inside LeadConversionService's transaction. */
  async create(input: CreateDealInput, session: ClientSession): Promise<DealDocument> {
    const [created] = await this.dealModel.create(
      [
        {
          ...input,
          stage: DealStage.OPEN,
          updatedBy: input.createdBy,
        },
      ],
      { session },
    );
    return created!;
  }

  async findBySourceLeadForWorkspace(
    workspaceId: string,
    sourceLeadId: string,
  ): Promise<DealDocument | null> {
    return this.dealModel.findOne({ workspaceId, sourceLeadId }).exec();
  }

  async findByIdForWorkspace(workspaceId: string, id: string): Promise<DealDocument | null> {
    return this.dealModel.findOne({ _id: id, workspaceId }).exec();
  }

  async list(
    workspaceId: string,
    filter: ListDealsFilter,
    sortBy: DealSortField,
    sortOrder: 1 | -1,
    page: number,
    limit: number,
  ): Promise<ListDealsResult> {
    const query: FilterQuery<DealDocument> = { workspaceId };
    if (filter.stage) {
      query.stage = filter.stage;
    }
    if (filter.assignedTo) {
      query.assignedTo = filter.assignedTo;
    }
    if (filter.customerId) {
      query.customerId = filter.customerId;
    }
    if (filter.expectedCloseFrom || filter.expectedCloseTo) {
      query.expectedCloseDate = {
        ...(filter.expectedCloseFrom ? { $gte: filter.expectedCloseFrom } : {}),
        ...(filter.expectedCloseTo ? { $lte: filter.expectedCloseTo } : {}),
      };
    }
    if (filter.q) {
      // §12 — Title only at the query level; Customer/Contact search would
      // need a cross-collection lookup (same TD-006-style deferral as
      // Customer's "Last Conversation" sort field).
      const pattern = new RegExp(filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.title = pattern;
    }

    const [items, total] = await Promise.all([
      this.dealModel
        .find(query)
        .sort({ [SORT_FIELD_MAP[sortBy]]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.dealModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  async update(
    workspaceId: string,
    id: string,
    input: UpdateDealInput,
    updatedBy: string,
  ): Promise<DealDocument | null> {
    return this.dealModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: { ...input, updatedBy } }, { new: true })
      .exec();
  }

  async updateAssignment(
    workspaceId: string,
    id: string,
    assignedTo: string | null,
    updatedBy: string,
  ): Promise<DealDocument | null> {
    return this.dealModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { assignedTo, updatedBy } },
        { new: true },
      )
      .exec();
  }

  /** BR-006 — wonAt/lostAt/lostReason are always set together with `stage` here, never independently. */
  async updateStage(
    workspaceId: string,
    id: string,
    stage: DealStage,
    updatedBy: string,
    outcome: { wonAt: Date | null; lostAt: Date | null; lostReason: DealLostReason | null },
  ): Promise<DealDocument | null> {
    return this.dealModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        { $set: { stage, ...outcome, updatedBy } },
        { new: true },
      )
      .exec();
  }

  /** §7 — reopen always resets to OPEN and clears the LOST outcome fields (resolved 2026-08-06). */
  async reopen(workspaceId: string, id: string, updatedBy: string): Promise<DealDocument | null> {
    return this.dealModel
      .findOneAndUpdate(
        { _id: id, workspaceId },
        {
          $set: {
            stage: DealStage.OPEN,
            wonAt: null,
            lostAt: null,
            lostReason: null,
            updatedBy,
          },
        },
        { new: true },
      )
      .exec();
  }
}
