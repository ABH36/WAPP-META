import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TenantRole } from "@wapp/shared-types";
import { EscalationService } from "./escalation.service.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { ConversationStatus } from "../schemas/conversation.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

function manager(id: string) {
  return { _id: { toString: () => id }, role: TenantRole.SALES_MANAGER };
}

function breachedConversation(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => "conversation-1" },
    contactId: { toString: () => "contact-1" },
    workspaceId: "workspace-1",
    status: ConversationStatus.OPEN,
    assignedToUserId: null,
    lastCustomerMessageAt: new Date("2026-08-06T00:00:00.000Z"),
    ...overrides,
  };
}

describe("EscalationService", () => {
  let service: EscalationService;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        EscalationService,
        {
          provide: ConversationRepository,
          useValue: {
            findSlaBreachCandidates: jest.fn(),
            assign: jest.fn(),
            countActiveAssignedToUser: jest.fn(),
            updateLastEscalatedAt: jest.fn(),
          },
        },
        { provide: UserRepository, useValue: { findByWorkspaceRolesActive: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(EscalationService);
    conversationRepository = moduleRef.get(ConversationRepository);
    userRepository = moduleRef.get(UserRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("does nothing when there are no breach candidates", async () => {
    conversationRepository.findSlaBreachCandidates.mockResolvedValue([]);

    const count = await service.runSweep(new Date());

    expect(count).toBe(0);
    expect(userRepository.findByWorkspaceRolesActive).not.toHaveBeenCalled();
  });

  it("reassigns to the least active eligible Manager and emits both events", async () => {
    const conversation = breachedConversation();
    conversationRepository.findSlaBreachCandidates.mockResolvedValue([conversation as never]);
    userRepository.findByWorkspaceRolesActive.mockResolvedValue([
      manager("manager-a"),
      manager("manager-b"),
    ] as never);
    conversationRepository.countActiveAssignedToUser.mockImplementation((_wsId, userId) =>
      Promise.resolve(userId === "manager-a" ? 4 : 1),
    );
    conversationRepository.assign.mockResolvedValue({ ...conversation } as never);

    const count = await service.runSweep(new Date("2026-08-06T04:00:00.000Z"));

    expect(count).toBe(1);
    expect(conversationRepository.assign).toHaveBeenCalledWith(
      "workspace-1",
      "conversation-1",
      "manager-b",
      ConversationStatus.ASSIGNED,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.CONVERSATION_ASSIGNED,
      expect.objectContaining({ assignedToUserId: "manager-b", actorId: "SYSTEM" }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.CONVERSATION_SLA_BREACHED,
      expect.objectContaining({
        conversationId: "conversation-1",
        escalatedToUserId: "manager-b",
        previousAssignedToUserId: null,
      }),
    );
    expect(conversationRepository.updateLastEscalatedAt).toHaveBeenCalledWith(
      "conversation-1",
      expect.any(Date),
    );
  });

  it("leaves a PENDING-adjacent status untouched but still reassigns when already ASSIGNED", async () => {
    const conversation = breachedConversation({
      status: ConversationStatus.ASSIGNED,
      assignedToUserId: "agent-original",
    });
    conversationRepository.findSlaBreachCandidates.mockResolvedValue([conversation as never]);
    userRepository.findByWorkspaceRolesActive.mockResolvedValue([manager("manager-a")] as never);
    conversationRepository.countActiveAssignedToUser.mockResolvedValue(0);
    conversationRepository.assign.mockResolvedValue({ ...conversation } as never);

    await service.runSweep(new Date());

    expect(conversationRepository.assign).toHaveBeenCalledWith(
      "workspace-1",
      "conversation-1",
      "manager-a",
      null,
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.CONVERSATION_SLA_BREACHED,
      expect.objectContaining({ previousAssignedToUserId: "agent-original" }),
    );
  });

  it("still reports the breach, without reassigning, when there is no eligible Manager", async () => {
    const conversation = breachedConversation();
    conversationRepository.findSlaBreachCandidates.mockResolvedValue([conversation as never]);
    userRepository.findByWorkspaceRolesActive.mockResolvedValue([]);

    const count = await service.runSweep(new Date());

    expect(count).toBe(1);
    expect(conversationRepository.assign).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      DomainEvent.CONVERSATION_ASSIGNED,
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.CONVERSATION_SLA_BREACHED,
      expect.objectContaining({ escalatedToUserId: null }),
    );
    expect(conversationRepository.updateLastEscalatedAt).toHaveBeenCalledWith(
      "conversation-1",
      expect.any(Date),
    );
  });

  it("isolates one candidate's failure from the rest of the sweep", async () => {
    const failing = breachedConversation({
      _id: { toString: () => "conversation-fail" },
    });
    const succeeding = breachedConversation({
      _id: { toString: () => "conversation-ok" },
    });
    conversationRepository.findSlaBreachCandidates.mockResolvedValue([
      failing,
      succeeding,
    ] as never);
    userRepository.findByWorkspaceRolesActive.mockImplementation((workspaceId: string) =>
      workspaceId === "workspace-1"
        ? Promise.resolve([manager("manager-a")] as never)
        : Promise.resolve([]),
    );
    conversationRepository.countActiveAssignedToUser.mockResolvedValue(0);
    conversationRepository.assign
      .mockRejectedValueOnce(new Error("Mongo write failed"))
      .mockResolvedValueOnce({ ...succeeding } as never);

    const count = await service.runSweep(new Date());

    expect(count).toBe(1);
    expect(conversationRepository.assign).toHaveBeenCalledTimes(2);
  });
});
