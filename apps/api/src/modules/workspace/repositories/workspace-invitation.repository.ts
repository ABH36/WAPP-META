import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { TenantRole } from "@wapp/shared-types";
import {
  PersistedInvitationStatus,
  WorkspaceInvitation,
  WorkspaceInvitationDocument,
} from "../schemas/workspace-invitation.schema.js";

export interface CreateInvitationInput {
  workspaceId: string;
  email: string;
  role: TenantRole;
  invitedBy: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class WorkspaceInvitationRepository {
  constructor(
    @InjectModel(WorkspaceInvitation.name)
    private readonly invitationModel: Model<WorkspaceInvitationDocument>,
  ) {}

  async create(input: CreateInvitationInput): Promise<WorkspaceInvitationDocument> {
    return this.invitationModel.create(input);
  }

  async findPendingByHash(tokenHash: string): Promise<WorkspaceInvitationDocument | null> {
    return this.invitationModel
      .findOne({ tokenHash, status: PersistedInvitationStatus.PENDING })
      .exec();
  }

  async findPendingByWorkspaceAndEmail(
    workspaceId: string,
    email: string,
  ): Promise<WorkspaceInvitationDocument | null> {
    return this.invitationModel
      .findOne({ workspaceId, email, status: PersistedInvitationStatus.PENDING })
      .exec();
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceInvitationDocument[]> {
    return this.invitationModel.find({ workspaceId }).sort({ createdAt: -1 }).exec();
  }

  async findByIdForWorkspace(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceInvitationDocument | null> {
    return this.invitationModel.findOne({ _id: id, workspaceId }).exec();
  }

  async markAccepted(id: string): Promise<void> {
    await this.invitationModel
      .updateOne(
        { _id: id },
        { $set: { status: PersistedInvitationStatus.ACCEPTED, acceptedAt: new Date() } },
      )
      .exec();
  }

  async markRevoked(id: string): Promise<void> {
    await this.invitationModel
      .updateOne(
        { _id: id },
        { $set: { status: PersistedInvitationStatus.REVOKED, revokedAt: new Date() } },
      )
      .exec();
  }
}
