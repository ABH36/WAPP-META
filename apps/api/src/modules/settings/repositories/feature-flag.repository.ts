import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  FeatureFlagKey,
  FeatureFlagState,
  FeatureFlagStateDocument,
} from "../schemas/feature-flag-state.schema.js";

// §4.5 — every workspace implicitly starts with the core modules visible
// and beta/experimental surfaces hidden, until explicitly toggled.
const DEFAULT_ENABLED: Record<FeatureFlagKey, boolean> = {
  [FeatureFlagKey.CRM_MODULE]: true,
  [FeatureFlagKey.BILLING_MODULE]: true,
  [FeatureFlagKey.COMMUNICATION_MODULE]: true,
  [FeatureFlagKey.AI_ASSISTANT]: false,
  [FeatureFlagKey.BETA_FEATURES]: false,
};

@Injectable()
export class FeatureFlagRepository {
  constructor(
    @InjectModel(FeatureFlagState.name)
    private readonly featureFlagModel: Model<FeatureFlagStateDocument>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<FeatureFlagStateDocument[]> {
    return this.featureFlagModel.find({ workspaceId }).exec();
  }

  async setEnabled(
    workspaceId: string,
    flagKey: FeatureFlagKey,
    enabled: boolean,
  ): Promise<FeatureFlagStateDocument> {
    return this.featureFlagModel
      .findOneAndUpdate(
        { workspaceId, flagKey },
        { $set: { enabled } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  static defaultFor(flagKey: FeatureFlagKey): boolean {
    return DEFAULT_ENABLED[flagKey];
  }

  /**
   * PRD-007 Volume-4 §4.5 (Platform KPIs, "Feature Adoption") — cross-tenant,
   * the one deliberate exception to this repository's otherwise
   * workspace-scoped methods (same pattern as Billing's
   * sumAllPaidPaymentsAcrossWorkspaces). A workspace with no explicit
   * FeatureFlagState document for this flag is using the flag's default —
   * `totalWorkspaces` lets the caller account for those implicitly-enabled
   * workspaces without a second round-trip.
   */
  async countEnabledAcrossWorkspaces(
    flagKey: FeatureFlagKey,
    totalWorkspaces: number,
  ): Promise<number> {
    const [explicitEnabled, explicitTotal] = await Promise.all([
      this.featureFlagModel.countDocuments({ flagKey, enabled: true }).exec(),
      this.featureFlagModel.countDocuments({ flagKey }).exec(),
    ]);
    const implicitCount = Math.max(totalWorkspaces - explicitTotal, 0);
    return explicitEnabled + (FeatureFlagRepository.defaultFor(flagKey) ? implicitCount : 0);
  }
}
