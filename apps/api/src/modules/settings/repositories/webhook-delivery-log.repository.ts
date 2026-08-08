import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { WebhookEventType } from "@wapp/shared-types";
import {
  WebhookDeliveryLog,
  WebhookDeliveryLogDocument,
} from "../schemas/webhook-delivery-log.schema.js";

export interface RecordDeliveryInput {
  webhookId: string;
  workspaceId: string;
  event: WebhookEventType;
  success: boolean;
  statusCode: number | null;
  error: string | null;
}

const DEFAULT_HISTORY_LIMIT = 20;

/** Insert-only — same immutable-audit-log shape as LoginHistoryRepository. No update or delete method exists here by design. */
@Injectable()
export class WebhookDeliveryLogRepository {
  constructor(
    @InjectModel(WebhookDeliveryLog.name)
    private readonly deliveryLogModel: Model<WebhookDeliveryLogDocument>,
  ) {}

  async record(input: RecordDeliveryInput): Promise<void> {
    await this.deliveryLogModel.create(input);
  }

  async findRecentByWebhook(
    webhookId: string,
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<WebhookDeliveryLogDocument[]> {
    return this.deliveryLogModel.find({ webhookId }).sort({ createdAt: -1 }).limit(limit).exec();
  }
}
