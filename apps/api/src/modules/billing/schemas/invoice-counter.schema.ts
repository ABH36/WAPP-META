import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type InvoiceCounterDocument = HydratedDocument<InvoiceCounter>;

/**
 * Backing store for per-workspace, gapless invoice numbering (resolved
 * 2026-08-07: per-workspace sequence, not a single global counter — avoids
 * a platform-wide write-contention point). One document per Workspace,
 * incremented atomically via findOneAndUpdate({workspaceId}, {$inc:
 * {seq: 1}}, {upsert: true}) — see InvoiceCounterRepository. Not itself a
 * PRD-005 §7/§8 entity; internal numbering infrastructure only.
 */
@Schema({ timestamps: true, collection: "invoice_counters" })
export class InvoiceCounter {
  @Prop({ type: String, required: true, unique: true })
  workspaceId!: string;

  @Prop({ type: Number, required: true, default: 0 })
  seq!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const InvoiceCounterSchema = SchemaFactory.createForClass(InvoiceCounter);
