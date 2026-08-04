import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
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
}
