import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model } from "mongoose";
import { DealStage } from "@wapp/shared-types";
import { Deal, DealDocument } from "../schemas/deal.schema.js";

export interface CreateDealInput {
  workspaceId: string;
  contactId: string;
  customerId: string;
  sourceLeadId: string;
  createdBy: string;
}

/**
 * PRD-004 Volume-3 §7 — minimal, conversion-only surface. Full Deal
 * Management (query/update/pipeline endpoints) is Part-4's own repository
 * work, not built here — see docs/ADR-CRM-010-deal-creation-boundary.md.
 */
@Injectable()
export class DealRepository {
  constructor(@InjectModel(Deal.name) private readonly dealModel: Model<DealDocument>) {}

  /** Always called inside LeadConversionService's transaction. */
  async create(input: CreateDealInput, session: ClientSession): Promise<DealDocument> {
    const [created] = await this.dealModel.create([{ ...input, stage: DealStage.NEW }], {
      session,
    });
    return created!;
  }

  async findBySourceLeadForWorkspace(
    workspaceId: string,
    sourceLeadId: string,
  ): Promise<DealDocument | null> {
    return this.dealModel.findOne({ workspaceId, sourceLeadId }).exec();
  }
}
