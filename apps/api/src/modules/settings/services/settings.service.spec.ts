import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SettingsService } from "./settings.service.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { StorageService } from "../../../infrastructure/storage/storage.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const workspace = {
  _id: { toString: () => "workspace-1" },
  businessProfile: { category: "Retail", description: null, gstin: null },
  businessHours: { timezone: "Asia/Kolkata", schedule: [], publicHolidays: [] },
  notificationSettings: {
    taskFollowUpReminder: true,
    conversationLeadAssignment: true,
    broadcastCompleted: true,
    subscriptionReminder: true,
  },
  language: "en",
};

const settings = {
  workspaceId: "workspace-1",
  logoUrl: null as string | null,
  logoPublicId: null as string | null,
  currency: "INR",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24h",
};

describe("SettingsService", () => {
  let service: SettingsService;
  let workspaceSettingsRepository: jest.Mocked<WorkspaceSettingsRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let storageService: jest.Mocked<StorageService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: WorkspaceSettingsRepository,
          useValue: {
            getOrCreate: jest.fn(),
            updatePreferences: jest.fn(),
            updateLogo: jest.fn(),
          },
        },
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        {
          provide: StorageService,
          useValue: { generateUploadSignature: jest.fn(), deleteAsset: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SettingsService);
    workspaceSettingsRepository = moduleRef.get(WorkspaceSettingsRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    storageService = moduleRef.get(StorageService);
    eventEmitter = moduleRef.get(EventEmitter2);

    workspaceRepository.findById.mockResolvedValue(workspace as never);
    workspaceSettingsRepository.getOrCreate.mockResolvedValue(settings as never);
  });

  describe("getOverview", () => {
    it("composes Workspace-orchestrated fields with Settings-owned branding/preferences", async () => {
      const result = await service.getOverview("workspace-1");

      expect(result.businessProfile).toEqual(workspace.businessProfile);
      expect(result.businessHours).toEqual(workspace.businessHours);
      expect(result.notificationSettings).toEqual(workspace.notificationSettings);
      expect(result.language).toBe("en");
      expect(result.branding).toEqual({ logoUrl: null });
      expect(result.preferences).toEqual({
        currency: "INR",
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
      });
    });
  });

  describe("updatePreferences", () => {
    it("updates preferences and emits SETTINGS_UPDATED(section=preferences)", async () => {
      workspaceSettingsRepository.updatePreferences.mockResolvedValue({
        ...settings,
        currency: "USD",
      } as never);

      const result = await service.updatePreferences("workspace-1", { currency: "USD" }, "user-1");

      expect(workspaceSettingsRepository.updatePreferences).toHaveBeenCalledWith("workspace-1", {
        currency: "USD",
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SETTINGS_UPDATED,
        expect.objectContaining({
          workspaceId: "workspace-1",
          section: "preferences",
          updatedBy: "user-1",
        }),
      );
      expect(result.preferences.currency).toBe("USD");
    });
  });

  describe("getLogoUploadSignature", () => {
    it("delegates to StorageService with a workspace-scoped folder, no DB write", () => {
      storageService.generateUploadSignature.mockReturnValue({
        signature: "sig",
        timestamp: 123,
        apiKey: "key",
        cloudName: "cloud",
        folder: "workspaces/workspace-1/logos",
      });

      const result = service.getLogoUploadSignature("workspace-1");

      expect(storageService.generateUploadSignature).toHaveBeenCalledWith(
        "workspaces/workspace-1/logos",
      );
      expect(workspaceSettingsRepository.getOrCreate).not.toHaveBeenCalled();
      expect(result.folder).toBe("workspaces/workspace-1/logos");
    });
  });

  describe("updateLogo", () => {
    it("persists the new reference without deleting anything when no logo existed before", async () => {
      workspaceSettingsRepository.updateLogo.mockResolvedValue({
        ...settings,
        logoUrl: "https://cdn/logo.png",
        logoPublicId: "pub-1",
      } as never);

      const result = await service.updateLogo(
        "workspace-1",
        { logoUrl: "https://cdn/logo.png", logoPublicId: "pub-1" },
        "user-1",
      );

      expect(storageService.deleteAsset).not.toHaveBeenCalled();
      expect(workspaceSettingsRepository.updateLogo).toHaveBeenCalledWith("workspace-1", {
        logoUrl: "https://cdn/logo.png",
        logoPublicId: "pub-1",
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.SETTINGS_UPDATED,
        expect.objectContaining({ section: "branding" }),
      );
      expect(result.branding.logoUrl).toBe("https://cdn/logo.png");
    });

    it("deletes the previous logo asset before persisting a replacement", async () => {
      workspaceSettingsRepository.getOrCreate.mockResolvedValue({
        ...settings,
        logoUrl: "https://cdn/old.png",
        logoPublicId: "pub-old",
      } as never);
      workspaceSettingsRepository.updateLogo.mockResolvedValue({
        ...settings,
        logoUrl: "https://cdn/new.png",
        logoPublicId: "pub-new",
      } as never);

      await service.updateLogo(
        "workspace-1",
        { logoUrl: "https://cdn/new.png", logoPublicId: "pub-new" },
        "user-1",
      );

      expect(storageService.deleteAsset).toHaveBeenCalledWith("pub-old");
    });
  });

  describe("removeLogo", () => {
    it("deletes the existing asset and clears the reference", async () => {
      workspaceSettingsRepository.getOrCreate.mockResolvedValue({
        ...settings,
        logoUrl: "https://cdn/old.png",
        logoPublicId: "pub-old",
      } as never);
      workspaceSettingsRepository.updateLogo.mockResolvedValue({
        ...settings,
        logoUrl: null,
        logoPublicId: null,
      } as never);

      const result = await service.removeLogo("workspace-1", "user-1");

      expect(storageService.deleteAsset).toHaveBeenCalledWith("pub-old");
      expect(workspaceSettingsRepository.updateLogo).toHaveBeenCalledWith("workspace-1", {
        logoUrl: null,
        logoPublicId: null,
      });
      expect(result.branding.logoUrl).toBeNull();
    });

    it("no-ops the delete call when there was no existing logo", async () => {
      workspaceSettingsRepository.updateLogo.mockResolvedValue(settings as never);

      await service.removeLogo("workspace-1", "user-1");

      expect(storageService.deleteAsset).not.toHaveBeenCalled();
    });
  });
});
