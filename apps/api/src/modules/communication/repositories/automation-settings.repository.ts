import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AssignmentStrategy,
  AutomationSettings,
  AutomationSettingsDocument,
} from "../schemas/automation-settings.schema.js";

export interface UpdateAutomationSettingsInput {
  welcomeMessageEnabled?: boolean;
  welcomeMessageText?: string | null;
  awayMessageEnabled?: boolean;
  awayMessageText?: string | null;
  assignmentStrategy?: AssignmentStrategy;
}

const DEFAULTS: Pick<
  AutomationSettings,
  | "welcomeMessageEnabled"
  | "welcomeMessageText"
  | "awayMessageEnabled"
  | "awayMessageText"
  | "assignmentStrategy"
  | "roundRobinLastAssignedUserId"
> = {
  welcomeMessageEnabled: false,
  welcomeMessageText: null,
  awayMessageEnabled: false,
  awayMessageText: null,
  assignmentStrategy: AssignmentStrategy.NONE,
  roundRobinLastAssignedUserId: null,
};

@Injectable()
export class AutomationSettingsRepository {
  constructor(
    @InjectModel(AutomationSettings.name)
    private readonly automationSettingsModel: Model<AutomationSettingsDocument>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<AutomationSettingsDocument | null> {
    return this.automationSettingsModel.findOne({ workspaceId }).exec();
  }

  /** Every read-side consumer (AutomationService) uses this — a workspace that's never configured automation gets sensible all-disabled defaults, not a null-check burden on every caller. */
  async findOrDefault(
    workspaceId: string,
  ): Promise<AutomationSettingsDocument | (typeof DEFAULTS & { workspaceId: string })> {
    const existing = await this.findByWorkspace(workspaceId);
    return existing ?? { workspaceId, ...DEFAULTS };
  }

  async upsert(
    workspaceId: string,
    input: UpdateAutomationSettingsInput,
    updatedBy: string,
  ): Promise<AutomationSettingsDocument> {
    // setDefaultsOnInsert (not a manual $setOnInsert) — every field the
    // schema itself declares a `default:` for is applied automatically on
    // the insert branch of the upsert. A manual $setOnInsert here would
    // conflict with $set whenever `input` and DEFAULTS share a key.
    return this.automationSettingsModel
      .findOneAndUpdate(
        { workspaceId },
        { $set: { ...input, updatedBy } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  /** Written only by AutoAssignmentService after a Round Robin pick — see roundRobinLastAssignedUserId's own doc comment. */
  async recordRoundRobinAssignment(workspaceId: string, userId: string): Promise<void> {
    await this.automationSettingsModel
      .updateOne({ workspaceId }, { $set: { roundRobinLastAssignedUserId: userId } })
      .exec();
  }
}
