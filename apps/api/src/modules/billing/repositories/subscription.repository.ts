import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { SubscriptionStatus } from "@wapp/shared-types";
import { Subscription, SubscriptionDocument } from "../schemas/subscription.schema.js";

export interface CreateSubscriptionInput {
  workspaceId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: Date;
  renewalDate: Date;
  trialEndsAt: Date | null;
  billingCycle: Subscription["billingCycle"];
  createdBy: string;
}

@Injectable()
export class SubscriptionRepository {
  constructor(
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  async create(input: CreateSubscriptionInput): Promise<SubscriptionDocument> {
    return this.subscriptionModel.create({
      ...input,
      pendingPlanId: null,
      graceEndsAt: null,
      cancelledAt: null,
      autoRenew: true,
      updatedBy: input.createdBy,
    });
  }

  async findByWorkspace(workspaceId: string): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel.findOne({ workspaceId }).exec();
  }

  async findById(id: string): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel.findOne({ _id: id }).exec();
  }

  /** §8 — Upgrade is immediate: planId changes now, any pending downgrade is cleared. */
  async applyUpgrade(
    id: string,
    planId: string,
    updatedBy: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { planId, pendingPlanId: null, updatedBy } },
        { new: true },
      )
      .exec();
  }

  /** §9 — Downgrade is queued; the lifecycle sweep applies it at renewalDate via applyPendingDowngrade. */
  async queueDowngrade(
    id: string,
    pendingPlanId: string,
    updatedBy: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOneAndUpdate({ _id: id }, { $set: { pendingPlanId, updatedBy } }, { new: true })
      .exec();
  }

  async applyPendingDowngrade(id: string): Promise<SubscriptionDocument | null> {
    const subscription = await this.subscriptionModel.findOne({ _id: id }).exec();
    if (!subscription?.pendingPlanId) {
      return subscription;
    }
    return this.subscriptionModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { planId: subscription.pendingPlanId, pendingPlanId: null } },
        { new: true },
      )
      .exec();
  }

  async cancel(id: string, updatedBy: string): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date(), updatedBy } },
        { new: true },
      )
      .exec();
  }

  async updateStatus(
    id: string,
    status: SubscriptionStatus,
    updatedBy: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOneAndUpdate({ _id: id }, { $set: { status, updatedBy } }, { new: true })
      .exec();
  }

  /** §11 — starts Grace Period, extends renewalDate/trialEndsAt bookkeeping isn't touched (historical). */
  async startGracePeriod(
    id: string,
    graceEndsAt: Date,
    updatedBy: string,
  ): Promise<SubscriptionDocument | null> {
    return this.subscriptionModel
      .findOneAndUpdate(
        { _id: id },
        { $set: { status: SubscriptionStatus.GRACE_PERIOD, graceEndsAt, updatedBy } },
        { new: true },
      )
      .exec();
  }

  /** §7/§4 — TRIAL still ongoing, trialEndsAt in the past: the lifecycle sweep's trial-expiry candidate query. */
  async findExpiredTrials(now: Date): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find({ status: SubscriptionStatus.TRIAL, trialEndsAt: { $ne: null, $lt: now } })
      .exec();
  }

  /** ACTIVE subscriptions whose renewalDate has passed with no Payments module yet to confirm a charge — same sweep, same outcome (Grace Period) as a lapsed trial. */
  async findLapsedActiveSubscriptions(now: Date): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find({ status: SubscriptionStatus.ACTIVE, renewalDate: { $lt: now } })
      .exec();
  }

  async findExpiredGracePeriods(now: Date): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find({ status: SubscriptionStatus.GRACE_PERIOD, graceEndsAt: { $ne: null, $lt: now } })
      .exec();
  }

  async findDuePendingDowngrades(now: Date): Promise<SubscriptionDocument[]> {
    return this.subscriptionModel
      .find({ pendingPlanId: { $ne: null }, renewalDate: { $lt: now } })
      .exec();
  }
}
