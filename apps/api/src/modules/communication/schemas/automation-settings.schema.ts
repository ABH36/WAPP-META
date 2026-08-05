import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AutomationSettingsDocument = HydratedDocument<AutomationSettings>;

/**
 * Part 4b (Auto Assignment) — see docs/COMM-AUTO-ASSIGNMENT.md. NONE means
 * auto-assignment is off (the pre-Part-4b default); a workspace opts into
 * exactly one strategy at a time, not both simultaneously.
 */
export enum AssignmentStrategy {
  NONE = "NONE",
  ROUND_ROBIN = "ROUND_ROBIN",
  LEAST_ACTIVE = "LEAST_ACTIVE",
}

/**
 * Traces to: PRD-003 Part 4 (Automation Engine — Welcome/Away Messages).
 * Deliberately Communication-owned, not added to the already-approved
 * Phase-3 Workspace schema — Welcome/Away is a Communication-specific
 * automation concern, not a general workspace setting, matching the
 * module-ownership boundary ADR-COMM-002 already established for Contact
 * vs. Customer. `Workspace.businessHours` (Phase-3) stays the single
 * source of truth for business hours themselves; this collection only
 * holds what's new here — the message text and enabled toggles.
 *
 * One document per workspace, created lazily on first read/write (see
 * AutomationSettingsRepository.findOrDefault) rather than at Workspace
 * creation time — no hook into Workspace's own (frozen, Phase-3) creation
 * flow was needed or added.
 */
@Schema({ timestamps: true, collection: "automation_settings" })
export class AutomationSettings {
  @Prop({ type: String, required: true, unique: true, index: true })
  workspaceId!: string;

  @Prop({ default: false })
  welcomeMessageEnabled!: boolean;

  @Prop({ type: String, default: null })
  welcomeMessageText!: string | null;

  @Prop({ default: false })
  awayMessageEnabled!: boolean;

  @Prop({ type: String, default: null })
  awayMessageText!: string | null;

  @Prop({ type: String, enum: AssignmentStrategy, default: AssignmentStrategy.NONE })
  assignmentStrategy!: AssignmentStrategy;

  // Round Robin's rotation pointer — the last agent an auto-assignment
  // picked, so the next one starts from the following eligible agent
  // rather than always restarting at the same person. Not user-facing
  // (never set via UpdateAutomationSettingsDto), only ever written by
  // AutoAssignmentService itself.
  @Prop({ type: String, default: null })
  roundRobinLastAssignedUserId!: string | null;

  @Prop({ type: String, default: null })
  updatedBy!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const AutomationSettingsSchema = SchemaFactory.createForClass(AutomationSettings);
