import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SidebarState, Theme, UiDensity } from "@wapp/shared-types";
import { UserPreferencesService } from "./user-preferences.service.js";
import { UserPreferencesRepository } from "../repositories/user-preferences.repository.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const notifications = {
  newAssignment: { inApp: true, email: true },
  newLead: { inApp: true, email: true },
  dealWon: { inApp: true, email: true },
  mention: { inApp: true, email: true },
  taskReminder: { inApp: true, email: true },
  followUpReminder: { inApp: true, email: true },
  billingReminder: { inApp: true, email: true },
};

const preferences = {
  userId: "user-1",
  theme: Theme.SYSTEM,
  sidebar: SidebarState.EXPANDED,
  density: UiDensity.COMFORTABLE,
  dateFormat: null as string | null,
  timeFormat: null as string | null,
  defaultLandingPage: null as string | null,
  pinnedPages: [] as string[],
  favoriteModules: [] as string[],
  notifications,
};

const workspaceSettings = {
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
};

const workspace = {
  businessHours: { timezone: "Asia/Kolkata" },
};

describe("UserPreferencesService", () => {
  let service: UserPreferencesService;
  let userPreferencesRepository: jest.Mocked<UserPreferencesRepository>;
  let workspaceSettingsRepository: jest.Mocked<WorkspaceSettingsRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UserPreferencesService,
        {
          provide: UserPreferencesRepository,
          useValue: {
            getOrCreate: jest.fn(),
            updatePreferences: jest.fn(),
            updateTheme: jest.fn(),
            updateDashboard: jest.fn(),
            updateNotifications: jest.fn(),
          },
        },
        { provide: WorkspaceSettingsRepository, useValue: { getOrCreate: jest.fn() } },
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(UserPreferencesService);
    userPreferencesRepository = moduleRef.get(UserPreferencesRepository);
    workspaceSettingsRepository = moduleRef.get(WorkspaceSettingsRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    eventEmitter = moduleRef.get(EventEmitter2);

    userPreferencesRepository.getOrCreate.mockResolvedValue(preferences as never);
    workspaceSettingsRepository.getOrCreate.mockResolvedValue(workspaceSettings as never);
    workspaceRepository.findById.mockResolvedValue(workspace as never);
  });

  describe("getOverview", () => {
    it("resolves dateFormat/timeFormat to the Workspace default when no personal override is set", async () => {
      const result = await service.getOverview("user-1", "workspace-1");

      expect(result.dateFormat).toEqual({ value: "DD/MM/YYYY", source: "WORKSPACE" });
      expect(result.timeFormat).toEqual({ value: "24h", source: "WORKSPACE" });
      expect(result.timezone).toBe("Asia/Kolkata");
    });

    it("resolves dateFormat/timeFormat to the personal override when one is set", async () => {
      userPreferencesRepository.getOrCreate.mockResolvedValue({
        ...preferences,
        dateFormat: "YYYY-MM-DD",
        timeFormat: "12h",
      } as never);

      const result = await service.getOverview("user-1", "workspace-1");

      expect(result.dateFormat).toEqual({ value: "YYYY-MM-DD", source: "USER" });
      expect(result.timeFormat).toEqual({ value: "12h", source: "USER" });
    });
  });

  describe("updatePreferences", () => {
    it("updates the override and emits USER_PREFERENCES_UPDATED(section=preferences)", async () => {
      await service.updatePreferences("user-1", "workspace-1", { dateFormat: "YYYY-MM-DD" });

      expect(userPreferencesRepository.updatePreferences).toHaveBeenCalledWith("user-1", {
        dateFormat: "YYYY-MM-DD",
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.USER_PREFERENCES_UPDATED,
        expect.objectContaining({ userId: "user-1", section: "preferences" }),
      );
    });
  });

  describe("updateTheme", () => {
    it("updates appearance fields and emits THEME_CHANGED", async () => {
      await service.updateTheme("user-1", "workspace-1", { theme: Theme.DARK });

      expect(userPreferencesRepository.updateTheme).toHaveBeenCalledWith("user-1", {
        theme: Theme.DARK,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.THEME_CHANGED,
        expect.objectContaining({ userId: "user-1" }),
      );
    });
  });

  describe("updateDashboard", () => {
    it("updates dashboard fields and emits USER_PREFERENCES_UPDATED(section=dashboard)", async () => {
      await service.updateDashboard("user-1", "workspace-1", { defaultLandingPage: "CRM" });

      expect(userPreferencesRepository.updateDashboard).toHaveBeenCalledWith("user-1", {
        defaultLandingPage: "CRM",
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.USER_PREFERENCES_UPDATED,
        expect.objectContaining({ userId: "user-1", section: "dashboard" }),
      );
    });
  });

  describe("updateNotifications", () => {
    it("updates notification preferences and emits NOTIFICATION_PREFERENCES_UPDATED", async () => {
      await service.updateNotifications("user-1", "workspace-1", {
        notifications: { mention: { inApp: false } },
      });

      expect(userPreferencesRepository.updateNotifications).toHaveBeenCalledWith("user-1", {
        notifications: { mention: { inApp: false } },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.NOTIFICATION_PREFERENCES_UPDATED,
        expect.objectContaining({ userId: "user-1" }),
      );
    });
  });
});
