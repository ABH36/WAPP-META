import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { WorkspaceCreatedListener } from "./workspace-created.listener.js";
import { SubscriptionService } from "../services/subscription.service.js";

describe("WorkspaceCreatedListener", () => {
  let listener: WorkspaceCreatedListener;
  let subscriptionService: jest.Mocked<SubscriptionService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspaceCreatedListener,
        { provide: SubscriptionService, useValue: { createTrialForWorkspace: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "workspace") {
                return { trialDurationDays: 14, invitationTokenTtlDays: 7 };
              }
              throw new Error(`Unexpected config key: ${key}`);
            },
          },
        },
      ],
    }).compile();

    listener = moduleRef.get(WorkspaceCreatedListener);
    subscriptionService = moduleRef.get(SubscriptionService);
  });

  it("creates a trial Subscription using the workspace config's trialDurationDays", async () => {
    subscriptionService.createTrialForWorkspace.mockResolvedValue({} as never);

    await listener.onWorkspaceCreated({
      workspaceId: "workspace-1",
      ownerId: "user-1",
      name: "Acme Co",
      occurredAt: new Date().toISOString(),
    });

    expect(subscriptionService.createTrialForWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      14,
      "user-1",
    );
  });
});
