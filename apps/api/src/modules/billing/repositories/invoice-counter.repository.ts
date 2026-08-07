import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { InvoiceCounter, InvoiceCounterDocument } from "../schemas/invoice-counter.schema.js";

@Injectable()
export class InvoiceCounterRepository {
  constructor(
    @InjectModel(InvoiceCounter.name)
    private readonly counterModel: Model<InvoiceCounterDocument>,
  ) {}

  /** Atomic per-workspace increment — race-safe under concurrent invoice generation. */
  async next(workspaceId: string): Promise<number> {
    const counter = await this.counterModel
      .findOneAndUpdate(
        { workspaceId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
    return counter.seq;
  }
}
