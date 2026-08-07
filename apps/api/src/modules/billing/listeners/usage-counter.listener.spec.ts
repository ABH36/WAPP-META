import { Test } from "@nestjs/testing";
import { UsageCounterType } from "@wapp/shared-types";
import { UsageCounterListener } from "./usage-counter.listener.js";
import { UsageService } from "../services/usage.service.js";

describe("UsageCounterListener", () => {
  let listener: UsageCounterListener;
  let usageService: jest.Mocked<UsageService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsageCounterListener,
        { provide: UsageService, useValue: { recordCreation: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(UsageCounterListener);
    usageService = moduleRef.get(UsageService);
  });

  const occurredAt = new Date().toISOString();

  it("counts an accepted Team Member (not a pending invite)", async () => {
    await listener.onTeamMemberAccepted({
      workspaceId: "workspace-1",
      userId: "u1",
      role: "OWNER",
      occurredAt,
    });
    expect(usageService.recordCreation).toHaveBeenCalledWith(
      "workspace-1",
      UsageCounterType.TEAM_MEMBERS,
    );
  });

  it("counts a created Customer", async () => {
    await listener.onCustomerCreated({
      workspaceId: "workspace-1",
      customerId: "c1",
      contactId: "ct1",
      source: "MANUAL",
      createdBy: "u1",
      occurredAt,
    });
    expect(usageService.recordCreation).toHaveBeenCalledWith(
      "workspace-1",
      UsageCounterType.CUSTOMERS,
    );
  });

  it("counts a created Lead", async () => {
    await listener.onLeadCreated({
      workspaceId: "workspace-1",
      leadId: "l1",
      contactId: "ct1",
      customerId: null,
      source: "MANUAL",
      createdBy: "u1",
      occurredAt,
    });
    expect(usageService.recordCreation).toHaveBeenCalledWith("workspace-1", UsageCounterType.LEADS);
  });

  it("counts a Deal created from Lead conversion (the only Deal-creation path, ADR-CRM-010)", async () => {
    await listener.onDealCreatedFromLead({
      workspaceId: "workspace-1",
      dealId: "d1",
      contactId: "ct1",
      customerId: "c1",
      sourceLeadId: "l1",
      createdBy: "u1",
      occurredAt,
    });
    expect(usageService.recordCreation).toHaveBeenCalledWith("workspace-1", UsageCounterType.DEALS);
  });

  it("counts a started Broadcast", async () => {
    await listener.onBroadcastStarted({
      workspaceId: "workspace-1",
      broadcastId: "b1",
      startedBy: "u1",
      occurredAt,
    });
    expect(usageService.recordCreation).toHaveBeenCalledWith(
      "workspace-1",
      UsageCounterType.BROADCASTS,
    );
  });

  it("counts a sent Message", async () => {
    await listener.onMessageSent({
      workspaceId: "workspace-1",
      conversationId: "conv1",
      contactId: "ct1",
      phoneNumberId: "p1",
      waMessageId: "wam1",
      sentBy: "u1",
      occurredAt,
    });
    expect(usageService.recordCreation).toHaveBeenCalledWith(
      "workspace-1",
      UsageCounterType.MESSAGES,
    );
  });
});
