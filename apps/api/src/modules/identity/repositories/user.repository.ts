import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { WorkspaceMemberStatus, type TenantRole } from "@wapp/shared-types";
import { User, UserDocument } from "../schemas/user.schema.js";

export interface CreateUserInput {
  fullName: string;
  email: string;
  mobileNumber: string;
  passwordHash: string;
}

/**
 * Owns all reads/writes to the `users` collection — every other Identity
 * class talks to Mongo through this repository, never through
 * `@InjectModel(User.name)` directly (SAD-002 DB-001 — one module owns one
 * collection, one repository owns the query surface for it).
 */
@Injectable()
export class UserRepository {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    const user = new this.userModel(input);
    return user.save();
  }

  async findByEmail(
    email: string,
    opts: { withPassword?: boolean } = {},
  ): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ email: email.toLowerCase(), isDeleted: false });
    if (opts.withPassword) {
      query.select("+passwordHash");
    }
    return query.exec();
  }

  async findByMobileNumber(mobileNumber: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ mobileNumber, isDeleted: false }).exec();
  }

  async findById(id: string, opts: { withPassword?: boolean } = {}): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ _id: id, isDeleted: false });
    if (opts.withPassword) {
      query.select("+passwordHash");
    }
    return query.exec();
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { isEmailVerified: true } }).exec();
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { passwordHash, failedLoginAttempts: 0, lockedUntil: null } },
      )
      .exec();
  }

  /** PRD-006 Volume-2 §4.5 — used by AuthService.changePassword() to check current password and reuse history. */
  async findByIdWithPasswordHistory(userId: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ _id: userId, isDeleted: false })
      .select("+passwordHash +previousPasswordHashes")
      .exec();
  }

  /** `previousPasswordHashes` is the caller's already-computed, already-capped next history array (AuthService owns the cap/trim logic, this just persists it). */
  async updatePasswordAndHistory(
    userId: string,
    passwordHash: string,
    previousPasswordHashes: string[],
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        {
          $set: {
            passwordHash,
            previousPasswordHashes,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        },
      )
      .exec();
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        { $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } },
      )
      .exec();
  }

  /**
   * Atomically increments the failed-attempt counter and, once it reaches
   * `maxAttempts`, locks the account until `lockoutMinutes` from now.
   * Returns the post-increment attempt count so the caller can decide what
   * to tell the user without a second round-trip.
   */
  async registerFailedLogin(
    userId: string,
    maxAttempts: number,
    lockoutMinutes: number,
  ): Promise<number> {
    const updated = await this.userModel
      .findOneAndUpdate({ _id: userId }, { $inc: { failedLoginAttempts: 1 } }, { new: true })
      .exec();

    if (updated && updated.failedLoginAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000);
      await this.userModel.updateOne({ _id: userId }, { $set: { lockedUntil } }).exec();
    }

    return updated?.failedLoginAttempts ?? 0;
  }

  // --- Consumed by the Workspace module via IdentityModule's exported
  // UserRepository (SAD-002 DB-001 — Workspace never gets its own handle on
  // the `users` collection). ---

  /** Used for both "create a Workspace → become OWNER" and "accept an invitation → become the invited role". */
  async assignWorkspaceMembership(
    userId: string,
    workspaceId: string,
    role: TenantRole,
    status: WorkspaceMemberStatus,
  ): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { workspaceId, role, workspaceMemberStatus: status } })
      .exec();
  }

  async updateWorkspaceRole(userId: string, role: TenantRole): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { role } }).exec();
  }

  async updateWorkspaceMemberStatus(userId: string, status: WorkspaceMemberStatus): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $set: { workspaceMemberStatus: status } })
      .exec();
  }

  async findWorkspaceMembers(workspaceId: string): Promise<UserDocument[]> {
    return this.userModel.find({ workspaceId, isDeleted: false }).sort({ createdAt: 1 }).exec();
  }

  async countActiveWorkspaceMembers(workspaceId: string): Promise<number> {
    return this.userModel
      .countDocuments({
        workspaceId,
        isDeleted: false,
        workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
      })
      .exec();
  }

  /**
   * Consumed by Communication's AutoAssignmentService (Part 4b) — the
   * eligible-agent pool for automatic Conversation assignment. Sorted by
   * `createdAt` ascending (same stable ordering `findWorkspaceMembers`
   * already uses) so Round Robin cycling is deterministic across calls.
   */
  async findByWorkspaceRolesActive(
    workspaceId: string,
    roles: readonly TenantRole[],
  ): Promise<UserDocument[]> {
    return this.userModel
      .find({
        workspaceId,
        isDeleted: false,
        workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
        role: { $in: roles },
      })
      .sort({ createdAt: 1 })
      .exec();
  }

  /** PRD-007 Volume-1 §4.2 (Platform Dashboard, Total Users) — cross-tenant, deliberately no workspaceId filter. */
  async countAll(): Promise<number> {
    return this.userModel.countDocuments({ isDeleted: false }).exec();
  }

  /** PRD-007 Volume-1 §4.6 (Workspace Search) — cross-tenant name/email search, capped, deliberately no workspaceId filter. */
  async searchAcrossWorkspaces(q: string, limit: number): Promise<UserDocument[]> {
    const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    return this.userModel
      .find({ isDeleted: false, $or: [{ fullName: pattern }, { email: pattern }] })
      .limit(limit)
      .exec();
  }
}
