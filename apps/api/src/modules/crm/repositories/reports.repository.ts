import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, PipelineStage } from "mongoose";
import {
  ActivityType,
  CustomerStatus,
  DealStage,
  LeadSource,
  LeadStatus,
  TaskStatus,
} from "@wapp/shared-types";
import { Customer, CustomerDocument } from "../schemas/customer.schema.js";
import { Lead, LeadDocument } from "../schemas/lead.schema.js";
import { Deal, DealDocument } from "../schemas/deal.schema.js";
import { Activity, ActivityDocument } from "../schemas/activity.schema.js";
import type { DistributionEntry, StageValueEntry } from "../crm.types.js";

export interface ReportsFilter {
  dateFrom?: Date;
  dateTo?: Date;
  assignedUserId?: string;
  customerId?: string;
  dealStage?: DealStage;
  leadStatus?: LeadStatus;
  leadSource?: LeadSource;
}

/** §5 — leads that have reached at least the qualified gate (no per-transition history exists, so this reads off current status only — see docs/ADR-CRM-019-crm-reporting-strategy.md). */
export const QUALIFIED_OR_BEYOND_LEAD_STATUSES: readonly LeadStatus[] = [
  LeadStatus.QUALIFIED,
  LeadStatus.PROPOSAL_SENT,
  LeadStatus.NEGOTIATION,
  LeadStatus.WON,
];

const OPEN_DEAL_STAGES: readonly DealStage[] = [
  DealStage.OPEN,
  DealStage.QUALIFICATION,
  DealStage.PROPOSAL,
  DealStage.NEGOTIATION,
];

interface HoursResult {
  averageHours: number | null;
}

/**
 * PRD-004 Volume-6 (CRM Reports & Dashboard). Read-only (BR-001/BR-002):
 * every method here is a query, never a write. Reads directly from
 * Customer/Lead/Deal/Activity's own models rather than routing through
 * their CRUD-oriented repositories, since Reports' whole purpose is
 * cross-entity aggregation those repositories were never designed for —
 * see docs/ADR-CRM-019-crm-reporting-strategy.md. Archived/soft-deleted
 * records are never excluded (BR-005, resolved 2026-08-07) — none of the
 * `$match` stages below filter on `archivedAt`/status in a way that would
 * hide them from totals.
 */
@Injectable()
export class ReportsRepository {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Deal.name) private readonly dealModel: Model<DealDocument>,
    @InjectModel(Activity.name) private readonly activityModel: Model<ActivityDocument>,
  ) {}

  // ---- Customer ----

  async countCustomers(workspaceId: string, filter: ReportsFilter): Promise<number> {
    return this.customerModel.countDocuments(this.baseMatch(workspaceId, filter)).exec();
  }

  async countCustomersByStatus(
    workspaceId: string,
    status: CustomerStatus,
    filter: ReportsFilter,
  ): Promise<number> {
    return this.customerModel
      .countDocuments({ ...this.baseMatch(workspaceId, filter), status })
      .exec();
  }

  // ---- Lead ----

  async countLeads(workspaceId: string, filter: ReportsFilter): Promise<number> {
    return this.leadModel.countDocuments(this.leadMatch(workspaceId, filter)).exec();
  }

  async countLeadsByStatus(
    workspaceId: string,
    status: LeadStatus,
    filter: ReportsFilter,
  ): Promise<number> {
    return this.leadModel.countDocuments({ ...this.leadMatch(workspaceId, filter), status }).exec();
  }

  async countLeadsByStatusIn(
    workspaceId: string,
    statuses: readonly LeadStatus[],
    filter: ReportsFilter,
  ): Promise<number> {
    return this.leadModel
      .countDocuments({
        ...this.leadMatch(workspaceId, filter),
        status: { $in: statuses as LeadStatus[] },
      })
      .exec();
  }

  async countConvertedLeads(workspaceId: string, filter: ReportsFilter): Promise<number> {
    return this.leadModel
      .countDocuments({ ...this.leadMatch(workspaceId, filter), convertedAt: { $ne: null } })
      .exec();
  }

  async groupLeadsBySource(
    workspaceId: string,
    filter: ReportsFilter,
  ): Promise<DistributionEntry[]> {
    return this.groupByField<LeadDocument>(
      this.leadModel,
      this.leadMatch(workspaceId, filter),
      "source",
    );
  }

  async groupLeadsByStatus(
    workspaceId: string,
    filter: ReportsFilter,
  ): Promise<DistributionEntry[]> {
    return this.groupByField<LeadDocument>(
      this.leadModel,
      this.leadMatch(workspaceId, filter),
      "status",
    );
  }

  /** §5 — approximation: (updatedAt - createdAt) for Leads currently at or past QUALIFIED (see docs/ADR-CRM-019-crm-reporting-strategy.md). */
  async averageQualificationTimeHours(
    workspaceId: string,
    filter: ReportsFilter,
  ): Promise<number | null> {
    const match: FilterQuery<LeadDocument> = {
      ...this.leadMatch(workspaceId, filter),
      status: { $in: QUALIFIED_OR_BEYOND_LEAD_STATUSES as LeadStatus[] },
    };
    return this.averageHoursBetween<LeadDocument>(this.leadModel, match, "createdAt", "updatedAt");
  }

  async groupLeadsByAssigneeStatus(
    workspaceId: string,
    status: LeadStatus,
    filter: ReportsFilter,
  ): Promise<DistributionEntry[]> {
    return this.groupByField<LeadDocument>(
      this.leadModel,
      { ...this.leadMatch(workspaceId, filter), status },
      "assignedUserId",
    );
  }

  // ---- Deal ----

  async countDeals(workspaceId: string, filter: ReportsFilter): Promise<number> {
    return this.dealModel.countDocuments(this.dealMatch(workspaceId, filter)).exec();
  }

  async countDealsByStageIn(
    workspaceId: string,
    stages: readonly DealStage[],
    filter: ReportsFilter,
  ): Promise<number> {
    return this.dealModel
      .countDocuments({
        ...this.dealMatch(workspaceId, filter),
        stage: { $in: stages as DealStage[] },
      })
      .exec();
  }

  async groupDealsByStage(workspaceId: string, filter: ReportsFilter): Promise<StageValueEntry[]> {
    const rows = await this.dealModel
      .aggregate<{ _id: DealStage; count: number; value: number }>([
        { $match: this.dealMatch(workspaceId, filter) },
        { $group: { _id: "$stage", count: { $sum: 1 }, value: { $sum: "$value" } } },
      ])
      .exec();
    return rows.map((row) => ({ stage: row._id, count: row.count, value: row.value }));
  }

  /** Sum of `value` for the given stages — used for §4/§6's Pipeline Value / Revenue by Stage. */
  async sumValueForStages(
    workspaceId: string,
    stages: readonly DealStage[],
    filter: ReportsFilter,
  ): Promise<number> {
    const [row] = await this.dealModel
      .aggregate<{ total: number }>([
        {
          $match: { ...this.dealMatch(workspaceId, filter), stage: { $in: stages as DealStage[] } },
        },
        { $group: { _id: null, total: { $sum: "$value" } } },
      ])
      .exec();
    return row?.total ?? 0;
  }

  /** §9 "Expected Revenue = Value × Probability" (ADR-CRM-013), summed over the given stages. */
  async sumForecastForStages(
    workspaceId: string,
    stages: readonly DealStage[],
    filter: ReportsFilter,
  ): Promise<number> {
    const [row] = await this.dealModel
      .aggregate<{ total: number }>([
        {
          $match: { ...this.dealMatch(workspaceId, filter), stage: { $in: stages as DealStage[] } },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $multiply: ["$value", { $divide: ["$probability", 100] }] } },
          },
        },
      ])
      .exec();
    return row?.total ?? 0;
  }

  async averageDealValue(workspaceId: string, filter: ReportsFilter): Promise<number> {
    const [row] = await this.dealModel
      .aggregate<{ average: number }>([
        { $match: this.dealMatch(workspaceId, filter) },
        { $group: { _id: null, average: { $avg: "$value" } } },
      ])
      .exec();
    return row?.average ?? 0;
  }

  /** §6 — precise (Deal.wonAt is a real field, unlike Lead's approximated qualification time). */
  async averageSalesCycleHours(workspaceId: string, filter: ReportsFilter): Promise<number | null> {
    const match: FilterQuery<DealDocument> = {
      ...this.dealMatch(workspaceId, filter),
      stage: DealStage.WON,
    };
    return this.averageHoursBetween<DealDocument>(this.dealModel, match, "createdAt", "wonAt");
  }

  /** §9 — Monthly/Quarterly/Yearly Forecast, standard calendar periods (resolved 2026-08-07). Only non-terminal Deals with a set expectedCloseDate contribute. */
  async groupForecastByPeriod(
    workspaceId: string,
    granularity: "month" | "quarter" | "year",
    filter: ReportsFilter,
  ): Promise<Array<{ period: string; value: number }>> {
    const periodExpr =
      granularity === "year"
        ? { $dateToString: { format: "%Y", date: "$expectedCloseDate" } }
        : granularity === "quarter"
          ? {
              $concat: [
                { $dateToString: { format: "%Y", date: "$expectedCloseDate" } },
                "-Q",
                {
                  $toString: {
                    $ceil: { $divide: [{ $month: "$expectedCloseDate" }, 3] },
                  },
                },
              ],
            }
          : { $dateToString: { format: "%Y-%m", date: "$expectedCloseDate" } };

    const rows = await this.dealModel
      .aggregate<{ _id: string; value: number }>([
        {
          $match: {
            ...this.dealMatch(workspaceId, filter),
            stage: { $in: OPEN_DEAL_STAGES as DealStage[] },
            expectedCloseDate: { $ne: null },
          },
        },
        {
          $group: {
            _id: periodExpr,
            value: { $sum: { $multiply: ["$value", { $divide: ["$probability", 100] }] } },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return rows.map((row) => ({ period: row._id, value: row.value }));
  }

  async dealsWonPerUser(workspaceId: string, filter: ReportsFilter): Promise<DistributionEntry[]> {
    return this.groupByField<DealDocument>(
      this.dealModel,
      { ...this.dealMatch(workspaceId, filter), stage: DealStage.WON },
      "assignedTo",
    );
  }

  async averageDealCyclePerUser(
    workspaceId: string,
    filter: ReportsFilter,
  ): Promise<Array<{ userId: string; averageHours: number | null }>> {
    const rows = await this.dealModel
      .aggregate<{ _id: string; averageHours: number }>([
        {
          $match: {
            ...this.dealMatch(workspaceId, filter),
            stage: DealStage.WON,
            assignedTo: { $ne: null },
          },
        },
        {
          $group: {
            _id: "$assignedTo",
            averageHours: { $avg: { $divide: [{ $subtract: ["$wonAt", "$createdAt"] }, 3600000] } },
          },
        },
      ])
      .exec();
    return rows.map((row) => ({ userId: row._id, averageHours: row.averageHours }));
  }

  // ---- Activity ----

  async countTasksByStatus(
    workspaceId: string,
    status: TaskStatus,
    filter: ReportsFilter,
  ): Promise<number> {
    return this.activityModel
      .countDocuments({
        ...this.activityMatch(workspaceId, filter),
        type: ActivityType.TASK,
        status,
      })
      .exec();
  }

  /** §4 — Overdue Tasks: incomplete, past due. */
  async countOverdueTasks(workspaceId: string, now: Date, filter: ReportsFilter): Promise<number> {
    return this.activityModel
      .countDocuments({
        ...this.activityMatch(workspaceId, filter),
        type: ActivityType.TASK,
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        dueDate: { $ne: null, $lt: now },
      })
      .exec();
  }

  /** §4 — Upcoming Follow-ups: incomplete, due within the resolved 7-day window. */
  async countUpcomingFollowUps(
    workspaceId: string,
    now: Date,
    windowEnd: Date,
    filter: ReportsFilter,
  ): Promise<number> {
    return this.activityModel
      .countDocuments({
        ...this.activityMatch(workspaceId, filter),
        type: ActivityType.FOLLOW_UP,
        followUpCompletedAt: null,
        followUpDate: { $gte: now, $lte: windowEnd },
      })
      .exec();
  }

  /** §7 — Follow-ups Due: incomplete, due now or overdue (distinct from the Dashboard's forward-looking Upcoming Follow-ups). */
  async countFollowUpsDue(workspaceId: string, now: Date, filter: ReportsFilter): Promise<number> {
    return this.activityModel
      .countDocuments({
        ...this.activityMatch(workspaceId, filter),
        type: ActivityType.FOLLOW_UP,
        followUpCompletedAt: null,
        followUpDate: { $ne: null, $lte: now },
      })
      .exec();
  }

  async countActivitiesByType(
    workspaceId: string,
    type: ActivityType,
    filter: ReportsFilter,
  ): Promise<number> {
    return this.activityModel
      .countDocuments({ ...this.activityMatch(workspaceId, filter), type })
      .exec();
  }

  async groupActivitiesByType(
    workspaceId: string,
    filter: ReportsFilter,
  ): Promise<DistributionEntry[]> {
    return this.groupByField<ActivityDocument>(
      this.activityModel,
      this.activityMatch(workspaceId, filter),
      "type",
    );
  }

  async tasksCompletedPerUser(
    workspaceId: string,
    filter: ReportsFilter,
  ): Promise<DistributionEntry[]> {
    return this.groupByField<ActivityDocument>(
      this.activityModel,
      {
        ...this.activityMatch(workspaceId, filter),
        type: ActivityType.TASK,
        status: TaskStatus.COMPLETED,
      },
      "assignedUserId",
    );
  }

  async followUpsCompletedPerUser(
    workspaceId: string,
    filter: ReportsFilter,
  ): Promise<DistributionEntry[]> {
    return this.groupByField<ActivityDocument>(
      this.activityModel,
      {
        ...this.activityMatch(workspaceId, filter),
        type: ActivityType.FOLLOW_UP,
        followUpCompletedAt: { $ne: null },
      },
      "assignedUserId",
    );
  }

  // ---- shared helpers ----

  private baseMatch(workspaceId: string, filter: ReportsFilter): FilterQuery<{ createdAt: Date }> {
    const match: FilterQuery<{ createdAt: Date; workspaceId: string }> = { workspaceId };
    if (filter.dateFrom || filter.dateTo) {
      match.createdAt = {
        ...(filter.dateFrom ? { $gte: filter.dateFrom } : {}),
        ...(filter.dateTo ? { $lte: filter.dateTo } : {}),
      };
    }
    return match;
  }

  private leadMatch(workspaceId: string, filter: ReportsFilter): FilterQuery<LeadDocument> {
    const match: FilterQuery<LeadDocument> = this.baseMatch(workspaceId, filter);
    if (filter.assignedUserId) match.assignedUserId = filter.assignedUserId;
    if (filter.customerId) match.customerId = filter.customerId;
    if (filter.leadStatus) match.status = filter.leadStatus;
    if (filter.leadSource) match.source = filter.leadSource;
    return match;
  }

  private dealMatch(workspaceId: string, filter: ReportsFilter): FilterQuery<DealDocument> {
    const match: FilterQuery<DealDocument> = this.baseMatch(workspaceId, filter);
    if (filter.assignedUserId) match.assignedTo = filter.assignedUserId;
    if (filter.customerId) match.customerId = filter.customerId;
    if (filter.dealStage) match.stage = filter.dealStage;
    return match;
  }

  private activityMatch(workspaceId: string, filter: ReportsFilter): FilterQuery<ActivityDocument> {
    const match: FilterQuery<ActivityDocument> = this.baseMatch(workspaceId, filter);
    if (filter.assignedUserId) match.assignedUserId = filter.assignedUserId;
    if (filter.customerId) match.customerId = filter.customerId;
    return match;
  }

  private async groupByField<T>(
    model: Model<T>,
    match: FilterQuery<T>,
    field: string,
  ): Promise<DistributionEntry[]> {
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ];
    const rows = await model.aggregate<{ _id: string | null; count: number }>(pipeline).exec();
    return rows.map((row) => ({ key: row._id ? String(row._id) : "UNASSIGNED", count: row.count }));
  }

  private async averageHoursBetween<T>(
    model: Model<T>,
    match: FilterQuery<T>,
    fromField: string,
    toField: string,
  ): Promise<number | null> {
    const [row] = await model
      .aggregate<HoursResult>([
        { $match: match },
        {
          $group: {
            _id: null,
            averageHours: {
              $avg: { $divide: [{ $subtract: [`$${toField}`, `$${fromField}`] }, 3600000] },
            },
          },
        },
      ])
      .exec();
    return row?.averageHours ?? null;
  }
}
