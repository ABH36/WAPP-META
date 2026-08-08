import { Test } from "@nestjs/testing";
import { WebhookEventType } from "@wapp/shared-types";
import { ConfigHistoryListener } from "./config-history.listener.js";
import { ConfigHistoryRepository } from "../repositories/config-history.repository.js";
import { WorkspaceSettingsRepository } from "../repositories/workspace-settings.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { WebhookConfigRepository } from "../repositories/webhook-config.repository.js";
import { ConfigHistoryArea } from "../schemas/config-history-entry.schema.js";
import { IntegrationConnectionStatus } from "../schemas/integration-status.enum.js";

describe("ConfigHistoryListener", () => {
  let listener: ConfigHistoryListener;
  let configHistoryRepository: jest.Mocked<ConfigHistoryRepository>;
  let workspaceSettingsRepository: jest.Mocked<WorkspaceSettingsRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let webhookConfigRepository: jest.Mocked<WebhookConfigRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfigHistoryListener,
        { provide: ConfigHistoryRepository, useValue: { record: jest.fn() } },
        { provide: WorkspaceSettingsRepository, useValue: { getOrCreate: jest.fn() } },
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        { provide: WebhookConfigRepository, useValue: { findByIdForWorkspace: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(ConfigHistoryListener);
    configHistoryRepository = moduleRef.get(ConfigHistoryRepository);
    workspaceSettingsRepository = moduleRef.get(WorkspaceSettingsRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    webhookConfigRepository = moduleRef.get(WebhookConfigRepository);
  });

  it("records a BRANDING entry with a live logoUrl snapshot", async () => {
    workspaceSettingsRepository.getOrCreate.mockResolvedValue({
      logoUrl: "https://cdn/logo.png",
    } as never);

    await listener.onSettingsUpdated({
      workspaceId: "workspace-1",
      section: "branding",
      updatedBy: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(configHistoryRepository.record).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      area: ConfigHistoryArea.BRANDING,
      newValue: { logoUrl: "https://cdn/logo.png" },
      changedBy: "user-1",
    });
  });

  it("skips WORKSPACE_UPDATED(business_profile) — not a tracked area", async () => {
    await listener.onWorkspaceUpdated({
      workspaceId: "workspace-1",
      section: "business_profile",
      updatedBy: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(workspaceRepository.findById).not.toHaveBeenCalled();
    expect(configHistoryRepository.record).not.toHaveBeenCalled();
  });

  it("records a BUSINESS_HOURS entry with a live snapshot", async () => {
    workspaceRepository.findById.mockResolvedValue({
      businessHours: { timezone: "Asia/Kolkata" },
    } as never);

    await listener.onWorkspaceUpdated({
      workspaceId: "workspace-1",
      section: "business_hours",
      updatedBy: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(configHistoryRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        area: ConfigHistoryArea.BUSINESS_HOURS,
        newValue: { businessHours: { timezone: "Asia/Kolkata" } },
      }),
    );
  });

  it("fetches the webhook and records its current config on WEBHOOK_CREATED", async () => {
    webhookConfigRepository.findByIdForWorkspace.mockResolvedValue({
      url: "https://example.com/hook",
      enabled: true,
      retryCount: 3,
      timeoutSeconds: 30,
      events: [WebhookEventType.LEAD_CREATED],
      status: IntegrationConnectionStatus.CONNECTED,
    } as never);

    await listener.onWebhookCreated({
      workspaceId: "workspace-1",
      webhookId: "webhook-1",
      actorId: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(configHistoryRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ area: ConfigHistoryArea.INTEGRATIONS, changedBy: "user-1" }),
    );
  });

  it("no-ops when the webhook no longer exists", async () => {
    webhookConfigRepository.findByIdForWorkspace.mockResolvedValue(null);

    await listener.onWebhookUpdated({
      workspaceId: "workspace-1",
      webhookId: "webhook-1",
      actorId: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(configHistoryRepository.record).not.toHaveBeenCalled();
  });

  it("records a FEATURE_FLAGS entry directly from the event payload", async () => {
    await listener.onFeatureFlagUpdated({
      workspaceId: "workspace-1",
      flagKey: "BETA_FEATURES",
      enabled: true,
      actorId: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(configHistoryRepository.record).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      area: ConfigHistoryArea.FEATURE_FLAGS,
      newValue: { flagKey: "BETA_FEATURES", enabled: true },
      changedBy: "user-1",
    });
  });
});
