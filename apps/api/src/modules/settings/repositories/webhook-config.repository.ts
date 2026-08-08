import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { WebhookEventType } from "@wapp/shared-types";
import { WebhookConfig, WebhookConfigDocument } from "../schemas/webhook-config.schema.js";
import { IntegrationConnectionStatus } from "../schemas/integration-status.enum.js";

export interface CreateWebhookConfigInput {
  workspaceId: string;
  url: string;
  secretEncrypted: string;
  enabled: boolean;
  retryCount: number;
  timeoutSeconds: number;
  events: WebhookEventType[];
}

export interface UpdateWebhookConfigInput {
  url?: string;
  secretEncrypted?: string;
  enabled?: boolean;
  retryCount?: number;
  timeoutSeconds?: number;
  events?: WebhookEventType[];
}

@Injectable()
export class WebhookConfigRepository {
  constructor(
    @InjectModel(WebhookConfig.name)
    private readonly webhookConfigModel: Model<WebhookConfigDocument>,
  ) {}

  async create(input: CreateWebhookConfigInput): Promise<WebhookConfigDocument> {
    return this.webhookConfigModel.create(input);
  }

  async findByWorkspace(workspaceId: string): Promise<WebhookConfigDocument[]> {
    return this.webhookConfigModel.find({ workspaceId }).sort({ createdAt: -1 }).exec();
  }

  async findByIdForWorkspace(
    workspaceId: string,
    id: string,
  ): Promise<WebhookConfigDocument | null> {
    return this.webhookConfigModel.findOne({ _id: id, workspaceId }).exec();
  }

  async findByIdWithSecret(id: string): Promise<WebhookConfigDocument | null> {
    return this.webhookConfigModel.findById(id).select("+secretEncrypted").exec();
  }

  /** The delivery-listener lookup — every enabled webhook in a workspace subscribed to this event. */
  async findActiveByWorkspaceAndEvent(
    workspaceId: string,
    event: WebhookEventType,
  ): Promise<WebhookConfigDocument[]> {
    return this.webhookConfigModel
      .find({ workspaceId, enabled: true, events: event })
      .select("+secretEncrypted")
      .exec();
  }

  async update(
    workspaceId: string,
    id: string,
    input: UpdateWebhookConfigInput,
  ): Promise<WebhookConfigDocument | null> {
    return this.webhookConfigModel
      .findOneAndUpdate({ _id: id, workspaceId }, { $set: input }, { new: true })
      .exec();
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.webhookConfigModel.deleteOne({ _id: id, workspaceId }).exec();
    return result.deletedCount > 0;
  }

  async recordDeliveryResult(id: string, success: boolean, error: string | null): Promise<void> {
    await this.webhookConfigModel
      .updateOne(
        { _id: id },
        {
          $set: {
            status: success
              ? IntegrationConnectionStatus.CONNECTED
              : IntegrationConnectionStatus.ERROR,
            lastDeliveryAt: new Date(),
            lastError: error,
          },
        },
      )
      .exec();
  }
}
