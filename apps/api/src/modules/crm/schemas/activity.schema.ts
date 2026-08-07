import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, SchemaTypes, Types } from "mongoose";
import {
  ActivityType,
  FollowUpType,
  ReminderType,
  TaskPriority,
  TaskStatus,
} from "@wapp/shared-types";

export type ActivityDocument = HydratedDocument<Activity>;

/**
 * Traces to: PRD-004 Volume-5 (Activities, Tasks, Follow-ups & Notes). A
 * SINGLE `activities` collection with a `type` discriminator (§4, per the
 * pre-scaffolded ActivityType's own doc comment, SAD-002 PATCH-003) — Task/
 * Follow-up/Note/Reminder/Call/Meeting/Email are all one schema, not
 * separate collections. Type-specific fields (dueDate, followUpDate, etc.)
 * are nullable and only meaningful for their owning type — see
 * docs/ADR-CRM-015-activity-timeline-strategy.md.
 *
 * References Customer and/or Deal (never both absent — BR-003) without
 * owning either (§19, docs/ADR-CRM-016-activity-ownership-strategy.md).
 * Does not reference Contact — Activities are operational/timeline records,
 * not identity records, and have no need for Contact's identity-resolution
 * machinery the way Customer/Lead/Deal do.
 */
@Schema({ timestamps: true, collection: "activities" })
export class Activity {
  @Prop({ type: String, required: true, index: true })
  workspaceId!: string;

  // BR-002 — immutable after creation, never editable via UpdateActivityDto.
  @Prop({ type: String, enum: ActivityType, required: true, index: true })
  type!: ActivityType;

  // §5/BR-003 — both optional individually, but at least one must be set
  // (validated in ActivityService, not expressible as a single Mongoose
  // required rule across two independent fields).
  @Prop({ type: SchemaTypes.ObjectId, ref: "Customer", default: null, index: true })
  customerId!: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: "Deal", default: null, index: true })
  dealId!: Types.ObjectId | null;

  // Common to most types — Task's title (§6), and a general subject line
  // for Call/Meeting/Email log entries. Not used by NOTE (see `text` below)
  // or REMINDER.
  @Prop({ type: String, default: null, trim: true })
  title!: string | null;

  // General free-text detail — Task's description (§6), and the log body
  // for Call/Meeting/Email. NOT used by NOTE, which has its own `text`
  // field (§8's richer note-specific shape).
  @Prop({ type: String, default: null })
  description!: string | null;

  // §8 — Note-specific. Rich text stored as-is (no server-side rendering);
  // `mentions` is a plain array of platform User ids, unvalidated against
  // workspace membership (no business rule requires it — see
  // docs/ADR-CRM-015-activity-timeline-strategy.md). Attachments are
  // explicitly Out of Scope (§20), so no field for them exists yet.
  @Prop({ type: String, default: null })
  text!: string | null;

  @Prop({ type: [String], default: [] })
  mentions!: string[];

  // §6 — Task-only. assignedUserId (below) is shared with Follow-up (§11
  // states both are assignable).
  @Prop({ type: Date, default: null })
  dueDate!: Date | null;

  @Prop({ type: String, enum: TaskPriority, default: null })
  priority!: TaskPriority | null;

  @Prop({ type: String, enum: TaskStatus, default: null })
  status!: TaskStatus | null;

  // §11 — Task and Follow-up only; a platform User id, not a Mongoose ref,
  // same convention Lead.assignedUserId/Deal.assignedTo already established.
  // No role restriction (unlike Lead/Deal's Sales-Executive-only model) —
  // any ACTIVE Workspace member is eligible (§11, BR-008).
  @Prop({ type: String, default: null, index: true })
  assignedUserId!: string | null;

  // §7 — Follow-up-only.
  @Prop({ type: Date, default: null })
  followUpDate!: Date | null;

  @Prop({ type: String, enum: FollowUpType, default: null })
  followUpType!: FollowUpType | null;

  // BR-005 — Follow-up's own binary completion marker, independent of
  // Task's 4-value `status` (a Follow-up has no PENDING/IN_PROGRESS/
  // CANCELLED concept in §7, only "not yet done" vs "done").
  @Prop({ type: Date, default: null })
  followUpCompletedAt!: Date | null;

  // §9 — Reminder-only. Scheduling data only; execution/delivery is
  // Notification-module scope (BR-007), not built here.
  @Prop({ type: Date, default: null })
  reminderDate!: Date | null;

  @Prop({ type: String, enum: ReminderType, default: null })
  reminderType!: ReminderType | null;

  // BR-006 — soft delete only, same pattern as Lead's archivedAt.
  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

// §10 — the chronological timeline query shape: every Activity for a given
// Customer or Deal, newest first.
ActivitySchema.index({ workspaceId: 1, customerId: 1, createdAt: -1 });
ActivitySchema.index({ workspaceId: 1, dealId: 1, createdAt: -1 });

// §13/§14 filters/sorting.
ActivitySchema.index({ workspaceId: 1, type: 1 });
ActivitySchema.index({ workspaceId: 1, status: 1 });
ActivitySchema.index({ workspaceId: 1, priority: 1 });
ActivitySchema.index({ workspaceId: 1, dueDate: 1 });
ActivitySchema.index({ workspaceId: 1, assignedUserId: 1 });

// §12 — Title/Notes free-text search.
ActivitySchema.index({ workspaceId: 1, title: 1 });
