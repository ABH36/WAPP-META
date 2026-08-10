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
      .updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } })
      .exec();
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
