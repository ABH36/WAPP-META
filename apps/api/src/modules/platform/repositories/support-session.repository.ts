import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model } from "mongoose";
import {
  SupportSession,
  SupportSessionDocument,
  SupportSessionStatus,
} from "../schemas/support-session.schema.js";

export interface CreateSupportSessionInput {
  workspaceId: string;
  requestedBy: string;
  reason: string;
  durationMinutes: number;
}

export interface ListSupportSessionsFilter {
  workspaceId?: string;
  status?: SupportSessionStatus;
}

export interface ListSupportSessionsResult {
  items: SupportSessionDocument[];
  total: number;
}

@Injectable()
export class SupportSessionRepository {
  constructor(
    @InjectModel(SupportSession.name)
    private readonly supportSessionModel: Model<SupportSessionDocument>,
  ) {}

  async create(input: CreateSupportSessionInput): Promise<SupportSessionDocument> {
    return this.supportSessionModel.create({
      ...input,
      status: SupportSessionStatus.REQUESTED,
      approvedBy: null,
      approvedAt: null,
      startedBy: null,
      startedAt: null,
      expiresAt: null,
      endedAt: null,
      terminationReason: null,
    });
  }

  async findById(id: string): Promise<SupportSessionDocument | null> {
    return this.supportSessionModel.findOne({ _id: id }).exec();
  }

  async approve(id: string, approvedBy: string): Promise<SupportSessionDocument | null> {
    return this.supportSessionModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { status: SupportSessionStatus.APPROVED, approvedBy, approvedAt: new Date() } },
        { new: true },
      )
      .exec();
  }

  async start(
    id: string,
    startedBy: string,
    expiresAt: Date,
  ): Promise<SupportSessionDocument | null> {
    return this.supportSessionModel
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            status: SupportSessionStatus.ACTIVE,
            startedBy,
            startedAt: new Date(),
            expiresAt,
          },
        },
        { new: true },
      )
      .exec();
  }

  async terminate(id: string, terminationReason: string): Promise<SupportSessionDocument | null> {
    return this.supportSessionModel
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            status: SupportSessionStatus.TERMINATED,
            endedAt: new Date(),
            terminationReason,
          },
        },
        { new: true },
      )
      .exec();
  }

  /** Lifecycle sweep only — see SupportSessionLifecycleProcessor. Never the enforcement path itself, see findActiveForWorkspaceAndUser's own comment. */
  async expire(id: string): Promise<SupportSessionDocument | null> {
    return this.supportSessionModel
      .findOneAndUpdate(
        { _id: id },
        {
          $set: {
            status: SupportSessionStatus.EXPIRED,
            endedAt: new Date(),
            terminationReason: "Expired automatically",
          },
        },
        { new: true },
      )
      .exec();
  }

  async list(
    filter: ListSupportSessionsFilter,
    page: number,
    limit: number,
  ): Promise<ListSupportSessionsResult> {
    const query: FilterQuery<SupportSessionDocument> = {};
    if (filter.workspaceId) {
      query.workspaceId = filter.workspaceId;
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const [items, total] = await Promise.all([
      this.supportSessionModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((Math.max(page, 1) - 1) * limit)
        .limit(limit)
        .exec(),
      this.supportSessionModel.countDocuments(query).exec(),
    ]);

    return { items, total };
  }

  /**
   * §11 — the real-time authorization check every gated cross-tenant read
   * goes through. Checks `expiresAt > now` directly rather than trusting
   * the `status` field alone, so access is denied immediately at expiry
   * even if the periodic sweep (SupportSessionLifecycleProcessor) hasn't
   * run yet — "an ACTIVE session must never remain valid after its
   * expiration time" (Architecture Review, 2026-08-10) is enforced here,
   * not by the sweep's cadence.
   */
  async findActiveForWorkspaceAndUser(
    workspaceId: string,
    platformUserId: string,
  ): Promise<SupportSessionDocument | null> {
    return this.supportSessionModel
      .findOne({
        workspaceId,
        startedBy: platformUserId,
        status: SupportSessionStatus.ACTIVE,
        expiresAt: { $gt: new Date() },
      })
      .exec();
  }

  /** SupportSessionLifecycleProcessor's sweep candidate query. */
  async findExpiredActive(now: Date): Promise<SupportSessionDocument[]> {
    return this.supportSessionModel
      .find({ status: SupportSessionStatus.ACTIVE, expiresAt: { $lte: now } })
      .exec();
  }
}
