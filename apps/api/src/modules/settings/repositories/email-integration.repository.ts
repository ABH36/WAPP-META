import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  EmailIntegrationConfig,
  EmailIntegrationConfigDocument,
  EmailEncryption,
  EmailProvider,
} from "../schemas/email-integration.schema.js";
import { IntegrationConnectionStatus } from "../schemas/integration-status.enum.js";

export interface UpsertEmailIntegrationInput {
  workspaceId: string;
  provider: EmailProvider;
  host: string;
  port: number;
  username: string;
  credentialEncrypted: string;
  encryption: EmailEncryption;
  fromAddress: string;
}

@Injectable()
export class EmailIntegrationRepository {
  constructor(
    @InjectModel(EmailIntegrationConfig.name)
    private readonly emailIntegrationModel: Model<EmailIntegrationConfigDocument>,
  ) {}

  async findByWorkspace(workspaceId: string): Promise<EmailIntegrationConfigDocument | null> {
    return this.emailIntegrationModel.findOne({ workspaceId }).exec();
  }

  async findByWorkspaceWithCredential(
    workspaceId: string,
  ): Promise<EmailIntegrationConfigDocument | null> {
    return this.emailIntegrationModel
      .findOne({ workspaceId })
      .select("+credentialEncrypted")
      .exec();
  }

  async upsert(input: UpsertEmailIntegrationInput): Promise<EmailIntegrationConfigDocument> {
    return this.emailIntegrationModel
      .findOneAndUpdate(
        { workspaceId: input.workspaceId },
        {
          $set: {
            provider: input.provider,
            host: input.host,
            port: input.port,
            username: input.username,
            credentialEncrypted: input.credentialEncrypted,
            encryption: input.encryption,
            fromAddress: input.fromAddress,
            status: IntegrationConnectionStatus.DISCONNECTED,
            lastError: null,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async recordTestResult(
    workspaceId: string,
    success: boolean,
    error: string | null,
  ): Promise<void> {
    await this.emailIntegrationModel
      .updateOne(
        { workspaceId },
        {
          $set: {
            status: success
              ? IntegrationConnectionStatus.CONNECTED
              : IntegrationConnectionStatus.ERROR,
            lastTestedAt: new Date(),
            lastError: error,
          },
        },
      )
      .exec();
  }
}
