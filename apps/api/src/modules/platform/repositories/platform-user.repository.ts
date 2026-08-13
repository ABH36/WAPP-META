import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { PlatformRole } from "@wapp/shared-types";
import { PlatformUser, PlatformUserDocument } from "../schemas/platform-user.schema.js";

export interface CreatePlatformUserInput {
  fullName: string;
  email: string;
  passwordHash: string;
  role: PlatformRole;
}

@Injectable()
export class PlatformUserRepository {
  constructor(
    @InjectModel(PlatformUser.name) private readonly platformUserModel: Model<PlatformUserDocument>,
  ) {}

  async create(input: CreatePlatformUserInput): Promise<PlatformUserDocument> {
    return this.platformUserModel.create(input);
  }

  async findByEmail(
    email: string,
    opts: { withPassword?: boolean } = {},
  ): Promise<PlatformUserDocument | null> {
    const query = this.platformUserModel.findOne({ email: email.toLowerCase() });
    if (opts.withPassword) {
      query.select("+passwordHash");
    }
    return query.exec();
  }

  async findById(id: string): Promise<PlatformUserDocument | null> {
    return this.platformUserModel.findOne({ _id: id }).exec();
  }

  async findAll(): Promise<PlatformUserDocument[]> {
    return this.platformUserModel.find().sort({ createdAt: -1 }).exec();
  }

  async recordSuccessfulLogin(id: string): Promise<void> {
    await this.platformUserModel
      .updateOne(
        { _id: id },
        { $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } },
      )
      .exec();
  }

  /**
   * PHD-001 Volume-1 (Security Hardening) — mirrors `UserRepository.registerFailedLogin()`
   * exactly (same atomic increment-then-lock pattern, same config values).
   * Returns the post-increment attempt count so the caller can decide what
   * to tell the user without a second round-trip.
   */
  async registerFailedLogin(
    id: string,
    maxAttempts: number,
    lockoutMinutes: number,
  ): Promise<number> {
    const updated = await this.platformUserModel
      .findOneAndUpdate({ _id: id }, { $inc: { failedLoginAttempts: 1 } }, { new: true })
      .exec();

    if (updated && updated.failedLoginAttempts >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60_000);
      await this.platformUserModel.updateOne({ _id: id }, { $set: { lockedUntil } }).exec();
    }

    return updated?.failedLoginAttempts ?? 0;
  }

  async setActive(id: string, isActive: boolean): Promise<PlatformUserDocument | null> {
    return this.platformUserModel
      .findOneAndUpdate({ _id: id }, { $set: { isActive } }, { new: true })
      .exec();
  }

  async countAll(): Promise<number> {
    return this.platformUserModel.countDocuments().exec();
  }

  /** PRD-007 Volume-4 §4.4 ("Platform Permission Changes") — Architecture Review, 2026-08-10: role-change capability, previously absent entirely. */
  async updateRole(id: string, role: PlatformRole): Promise<PlatformUserDocument | null> {
    return this.platformUserModel
      .findOneAndUpdate({ _id: id }, { $set: { role } }, { new: true })
      .exec();
  }
}
