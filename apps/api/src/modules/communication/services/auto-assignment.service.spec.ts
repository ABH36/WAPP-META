import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TenantRole } from "@wapp/shared-types";
import { AutoAssignmentService } from "./auto-assignment.service.js";
import { AutomationSettingsRepository } from "../repositories/automation-settings.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { AssignmentStrategy } from "../schemas/automation-settings.schema.js";
import { ConversationStatus } from "../schemas/conversation.schema.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

function agent(id: string, role: TenantRole = TenantRole.SALES_EXECUTIVE) {
  return { _id: { toString: () => id }, role };
}

describe("AutoAssignmentService", () => {
  let service: AutoAssignmentService;
  let automationSettingsRepository: jest.Mocked<AutomationSettingsRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const unassignedNewConversation = {
    _id: { toString: () => "conversation-1" },
    contactId: { toString: () => "contact-1" },
    status: ConversationStatus.NEW,
    assignedToUserId: null,
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AutoAssignmentService,
        {
          provide: AutomationSettingsRepository,
          useValue: { findOrDefault: jest.fn(), recordRoundRobinAssignment: jest.fn() },
        },
        { provide: UserRepository, useValue: { findByWorkspaceRolesActive: jest.fn() } },
        {
          provide: ConversationRepository,
          useValue: { assign: jest.fn(), countActiveAssignedToUser: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AutoAssignmentService);
    automationSettingsRepository = moduleRef.get(AutomationSettingsRepository);
    userRepository = moduleRef.get(UserRepository);
    conversationRepository = moduleRef.get(ConversationRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("does nothing when the conversation is already assigned", async () => {
    const alreadyAssigned = { ...unassignedNewConversation, assignedToUserId: "agent-existing" };

    await service.maybeAssign("workspace-1", alreadyAssigned as never);

    expect(automationSettingsRepository.findOrDefault).not.toHaveBeenCalled();
    expect(conversationRepository.assign).not.toHaveBeenCalled();
  });

  it("does nothing when the workspace's strategy is NONE", async () => {
    automationSettingsRepository.findOrDefault.mockResolvedValue({
      assignmentStrategy: AssignmentStrategy.NONE,
      roundRobinLastAssignedUserId: null,
    } as never);

    await service.maybeAssign("workspace-1", unassignedNewConversation as never);

    expect(userRepository.findByWorkspaceRolesActive).not.toHaveBeenCalled();
    expect(conversationRepository.assign).not.toHaveBeenCalled();
  });

  it("does nothing when there are no eligible agents", async () => {
    automationSettingsRepository.findOrDefault.mockResolvedValue({
      assignmentStrategy: AssignmentStrategy.ROUND_ROBIN,
      roundRobinLastAssignedUserId: null,
    } as never);
    userRepository.findByWorkspaceRolesActive.mockResolvedValue([]);

    await service.maybeAssign("workspace-1", unassignedNewConversation as never);

    expect(conversationRepository.assign).not.toHaveBeenCalled();
  });

  describe("Round Robin", () => {
    it("picks the first eligible agent when there is no prior pick", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        assignmentStrategy: AssignmentStrategy.ROUND_ROBIN,
        roundRobinLastAssignedUserId: null,
      } as never);
      userRepository.findByWorkspaceRolesActive.mockResolvedValue([
        agent("agent-a"),
        agent("agent-b"),
      ] as never);
      conversationRepository.assign.mockResolvedValue({
        ...unassignedNewConversation,
      } as never);

      await service.maybeAssign("workspace-1", unassignedNewConversation as never);

      expect(conversationRepository.assign).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        "agent-a",
        ConversationStatus.ASSIGNED,
      );
      expect(automationSettingsRepository.recordRoundRobinAssignment).toHaveBeenCalledWith(
        "workspace-1",
        "agent-a",
      );
    });

    it("picks the next agent after the last one assigned, wrapping around", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        assignmentStrategy: AssignmentStrategy.ROUND_ROBIN,
        roundRobinLastAssignedUserId: "agent-b",
      } as never);
      userRepository.findByWorkspaceRolesActive.mockResolvedValue([
        agent("agent-a"),
        agent("agent-b"),
      ] as never);
      conversationRepository.assign.mockResolvedValue({ ...unassignedNewConversation } as never);

      await service.maybeAssign("workspace-1", unassignedNewConversation as never);

      // agent-b was last -> wraps back to agent-a (index 0).
      expect(conversationRepository.assign).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        "agent-a",
        ConversationStatus.ASSIGNED,
      );
    });

    it("restarts at the first eligible agent if the last-assigned agent is no longer eligible", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        assignmentStrategy: AssignmentStrategy.ROUND_ROBIN,
        roundRobinLastAssignedUserId: "agent-removed",
      } as never);
      userRepository.findByWorkspaceRolesActive.mockResolvedValue([
        agent("agent-a"),
        agent("agent-b"),
      ] as never);
      conversationRepository.assign.mockResolvedValue({ ...unassignedNewConversation } as never);

      await service.maybeAssign("workspace-1", unassignedNewConversation as never);

      expect(conversationRepository.assign).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        "agent-a",
        ConversationStatus.ASSIGNED,
      );
    });
  });

  describe("Least Active Agent", () => {
    it("picks the eligible agent with the fewest active conversations", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        assignmentStrategy: AssignmentStrategy.LEAST_ACTIVE,
        roundRobinLastAssignedUserId: null,
      } as never);
      userRepository.findByWorkspaceRolesActive.mockResolvedValue([
        agent("agent-a"),
        agent("agent-b"),
      ] as never);
      conversationRepository.countActiveAssignedToUser.mockImplementation((_wsId, userId) =>
        Promise.resolve(userId === "agent-a" ? 5 : 2),
      );
      conversationRepository.assign.mockResolvedValue({ ...unassignedNewConversation } as never);

      await service.maybeAssign("workspace-1", unassignedNewConversation as never);

      expect(conversationRepository.assign).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        "agent-b",
        ConversationStatus.ASSIGNED,
      );
      // Least Active never touches the Round Robin pointer.
      expect(automationSettingsRepository.recordRoundRobinAssignment).not.toHaveBeenCalled();
    });

    it("breaks ties using the stable eligible-agent order", async () => {
      automationSettingsRepository.findOrDefault.mockResolvedValue({
        assignmentStrategy: AssignmentStrategy.LEAST_ACTIVE,
        roundRobinLastAssignedUserId: null,
      } as never);
      userRepository.findByWorkspaceRolesActive.mockResolvedValue([
        agent("agent-a"),
        agent("agent-b"),
      ] as never);
      conversationRepository.countActiveAssignedToUser.mockResolvedValue(3);
      conversationRepository.assign.mockResolvedValue({ ...unassignedNewConversation } as never);

      await service.maybeAssign("workspace-1", unassignedNewConversation as never);

      expect(conversationRepository.assign).toHaveBeenCalledWith(
        "workspace-1",
        "conversation-1",
        "agent-a",
        ConversationStatus.ASSIGNED,
      );
    });
  });

  it("leaves a PENDING conversation's status untouched (only assignedToUserId changes)", async () => {
    const pendingConversation = {
      ...unassignedNewConversation,
      status: ConversationStatus.PENDING,
    };
    automationSettingsRepository.findOrDefault.mockResolvedValue({
      assignmentStrategy: AssignmentStrategy.ROUND_ROBIN,
      roundRobinLastAssignedUserId: null,
    } as never);
    userRepository.findByWorkspaceRolesActive.mockResolvedValue([agent("agent-a")] as never);
    conversationRepository.assign.mockResolvedValue({ ...pendingConversation } as never);

    await service.maybeAssign("workspace-1", pendingConversation as never);

    expect(conversationRepository.assign).toHaveBeenCalledWith(
      "workspace-1",
      "conversation-1",
      "agent-a",
      null,
    );
  });

  it("emits CONVERSATION_ASSIGNED with the SYSTEM actor after a successful assignment", async () => {
    automationSettingsRepository.findOrDefault.mockResolvedValue({
      assignmentStrategy: AssignmentStrategy.ROUND_ROBIN,
      roundRobinLastAssignedUserId: null,
    } as never);
    userRepository.findByWorkspaceRolesActive.mockResolvedValue([agent("agent-a")] as never);
    conversationRepository.assign.mockResolvedValue({ ...unassignedNewConversation } as never);

    await service.maybeAssign("workspace-1", unassignedNewConversation as never);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.CONVERSATION_ASSIGNED,
      expect.objectContaining({
        workspaceId: "workspace-1",
        conversationId: "conversation-1",
        contactId: "contact-1",
        assignedToUserId: "agent-a",
        actorId: "SYSTEM",
      }),
    );
  });

  it("never throws, even if the underlying assign call fails", async () => {
    automationSettingsRepository.findOrDefault.mockResolvedValue({
      assignmentStrategy: AssignmentStrategy.ROUND_ROBIN,
      roundRobinLastAssignedUserId: null,
    } as never);
    userRepository.findByWorkspaceRolesActive.mockResolvedValue([agent("agent-a")] as never);
    conversationRepository.assign.mockRejectedValue(new Error("Mongo write failed"));

    await expect(
      service.maybeAssign("workspace-1", unassignedNewConversation as never),
    ).resolves.toBeUndefined();
  });
});
