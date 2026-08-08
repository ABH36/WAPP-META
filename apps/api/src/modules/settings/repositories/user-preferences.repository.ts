import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { SidebarState, Theme, UiDensity } from "@wapp/shared-types";
import { UserPreferences, UserPreferencesDocument } from "../schemas/user-preferences.schema.js";

export interface UpdatePreferencesInput {
  dateFormat?: string | null;
  timeFormat?: string | null;
}

export interface UpdateThemeInput {
  theme?: Theme;
  sidebar?: SidebarState;
  density?: UiDensity;
}

export interface UpdateDashboardInput {
  defaultLandingPage?: string | null;
  pinnedPages?: string[];
  favoriteModules?: string[];
}

export interface UpdateNotificationsInput {
  notifications: object;
}

@Injectable()
export class UserPreferencesRepository {
  constructor(
    @InjectModel(UserPreferences.name)
    private readonly userPreferencesModel: Model<UserPreferencesDocument>,
  ) {}

  /** Idempotent get-or-create — every user gets a preferences document lazily, on first access. */
  async getOrCreate(userId: string): Promise<UserPreferencesDocument> {
    return this.userPreferencesModel
      .findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput,
  ): Promise<UserPreferencesDocument> {
    return this.setFields(userId, input);
  }

  async updateTheme(userId: string, input: UpdateThemeInput): Promise<UserPreferencesDocument> {
    return this.setFields(userId, input);
  }

  async updateDashboard(
    userId: string,
    input: UpdateDashboardInput,
  ): Promise<UserPreferencesDocument> {
    return this.setFields(userId, input);
  }

  async updateNotifications(
    userId: string,
    input: UpdateNotificationsInput,
  ): Promise<UserPreferencesDocument> {
    const notifications = input.notifications as Record<
      string,
      Record<string, boolean | undefined>
    >;
    const update: Record<string, unknown> = {};
    for (const [event, channels] of Object.entries(notifications)) {
      // class-transformer leaves every declared-but-not-sent DTO field as an
      // explicit `undefined` own property, not simply absent — Object.entries
      // still yields it, so `channels` itself can be undefined here even
      // though the caller only sent a subset of the 7 events.
      if (channels === undefined || channels === null) {
        continue;
      }
      for (const [channel, value] of Object.entries(channels)) {
        if (value !== undefined) {
          update[`notifications.${event}.${channel}`] = value;
        }
      }
    }
    return this.userPreferencesModel
      .findOneAndUpdate(
        { userId },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  private async setFields(userId: string, input: object): Promise<UserPreferencesDocument> {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        update[key] = value;
      }
    }
    return this.userPreferencesModel
      .findOneAndUpdate(
        { userId },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
