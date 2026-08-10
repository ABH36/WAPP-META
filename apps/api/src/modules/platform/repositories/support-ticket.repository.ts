import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import {
  SupportTicket,
  SupportTicketCategory,
  SupportTicketDocument,
  SupportTicketPriority,
  SupportTicketStatus,
} from "../schemas/support-ticket.schema.js";

export interface CreateSupportTicketInput {
  workspaceId: string;
  title: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  createdBy: string;
}

export interface UpdateSupportTicketInput {
  status?: SupportTicketStatus;
  assignedOperator?: string | null;
  resolution?: string | null;
}

export interface ListSupportTicketsFilter {
  workspaceId?: string;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedOperator?: string;
}

@Injectable()
export class SupportTicketRepository {
  constructor(
    @InjectModel(SupportTicket.name)
    private readonly supportTicketModel: Model<SupportTicketDocument>,
  ) {}

  async create(input: CreateSupportTicketInput): Promise<SupportTicketDocument> {
    return this.supportTicketModel.create({
      ...input,
      status: SupportTicketStatus.OPEN,
      assignedOperator: null,
      resolution: null,
    });
  }

  async findById(id: string): Promise<SupportTicketDocument | null> {
    return this.supportTicketModel.findOne({ _id: id }).exec();
  }

  async list(filter: ListSupportTicketsFilter): Promise<SupportTicketDocument[]> {
    const query: FilterQuery<SupportTicketDocument> = {};
    if (filter.workspaceId) {
      query.workspaceId = filter.workspaceId;
    }
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.priority) {
      query.priority = filter.priority;
    }
    if (filter.assignedOperator) {
      query.assignedOperator = filter.assignedOperator;
    }
    return this.supportTicketModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async update(id: string, input: UpdateSupportTicketInput): Promise<SupportTicketDocument | null> {
    return this.supportTicketModel
      .findOneAndUpdate({ _id: id }, { $set: input }, { new: true })
      .exec();
  }

  /**
   * PRD-007 Volume-4 §4.5 (Platform KPIs, "Support Resolution Time") —
   * approximated as `updatedAt - createdAt` for RESOLVED/CLOSED tickets,
   * since this schema (frozen, PRD-007 Volume-2) has no dedicated
   * `resolvedAt` field. A ticket that bounced back through WAITING_CUSTOMER
   * before resolving would slightly understate its true resolution time —
   * an accepted approximation rather than a frozen-schema change for one
   * KPI. See docs/ADR-PLAT-008-platform-analytics-strategy.md.
   */
  async getAverageResolutionHours(): Promise<number | null> {
    const rows = await this.supportTicketModel
      .aggregate<{ avgMs: number }>([
        { $match: { status: { $in: [SupportTicketStatus.RESOLVED, SupportTicketStatus.CLOSED] } } },
        {
          $group: {
            _id: null,
            avgMs: { $avg: { $subtract: ["$updatedAt", "$createdAt"] } },
          },
        },
      ])
      .exec();
    const row = rows[0];
    return row ? row.avgMs / (1000 * 60 * 60) : null;
  }
}
