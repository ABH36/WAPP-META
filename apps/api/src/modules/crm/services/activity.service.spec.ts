import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ActivityType, TaskStatus, TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";
import { ActivityService } from "./activity.service.js";
import { ActivityRepository } from "../repositories/activity.repository.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { DealRepository } from "../repositories/deal.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const ASSIGNEE_ID = "507f1f77bcf86cd799439011";

const baseTask = {
  _id: { toString: () => "activity-1" },
  workspaceId: "workspace-1",
  type: ActivityType.TASK,
  customerId: { toString: () => "customer-1" },
  dealId: null as { toString(): string } | null,
  title: "Follow up on quote",
  description: null,
  text: null,
  mentions: [] as string[],
  dueDate: null,
  priority: null,
  status: TaskStatus.PENDING,
  assignedUserId: null as string | null,
  followUpDate: null,
  followUpType: null,
  followUpCompletedAt: null as Date | null,
  reminderDate: null,
  reminderType: null,
  archivedAt: null as Date | null,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: new Date("2026-08-07T00:00:00.000Z"),
  updatedAt: new Date("2026-08-07T00:00:00.000Z"),
};

const eligibleAssignee = {
  _id: { toString: () => ASSIGNEE_ID },
  workspaceId: "workspace-1",
  workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
  role: TenantRole.SUPPORT_EXECUTIVE,
};

describe("ActivityService", () => {
  let service: ActivityService;
  let activityRepository: jest.Mocked<ActivityRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let dealRepository: jest.Mocked<DealRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: ActivityRepository,
          useValue: {
            create: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            list: jest.fn(),
            update: jest.fn(),
            updateAssignment: jest.fn(),
            updateTaskStatus: jest.fn(),
            completeFollowUp: jest.fn(),
            archive: jest.fn(),
          },
        },
        { provide: CustomerRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        { provide: DealRepository, useValue: { findByIdForWorkspace: jest.fn() } },
        { provide: UserRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ActivityService);
    activityRepository = moduleRef.get(ActivityRepository);
    customerRepository = moduleRef.get(CustomerRepository);
    dealRepository = moduleRef.get(DealRepository);
    userRepository = moduleRef.get(UserRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("rejects type=NOTE (must use createNote)", async () => {
      await expect(
        service.create(
          "workspace-1",
          { type: ActivityType.NOTE, customerId: "customer-1" },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when neither customerId nor dealId is supplied", async () => {
      await expect(
        service.create("workspace-1", { type: ActivityType.TASK }, "user-1", TenantRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an invalid Customer reference", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(
        service.create(
          "workspace-1",
          { type: ActivityType.TASK, customerId: "customer-1" },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when the actor lacks EDIT_CUSTOMER for the referenced Customer", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({} as never);

      await expect(
        service.create(
          "workspace-1",
          { type: ActivityType.TASK, customerId: "customer-1" },
          "user-1",
          TenantRole.MARKETING_EXECUTIVE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejects when the actor lacks CREATE_DEALS for the referenced Deal", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({} as never);

      await expect(
        service.create(
          "workspace-1",
          { type: ActivityType.TASK, dealId: "deal-1" },
          "user-1",
          TenantRole.SUPPORT_EXECUTIVE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("creates a Task with status=PENDING and emits the generic ACTIVITY_CREATED", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      activityRepository.create.mockResolvedValue(baseTask as never);

      const result = await service.create(
        "workspace-1",
        { type: ActivityType.TASK, customerId: "customer-1", title: "Follow up on quote" },
        "user-1",
        TenantRole.OWNER,
      );

      expect(activityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: ActivityType.TASK, status: TaskStatus.PENDING }),
      );
      expect(result.id).toBe("activity-1");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.ACTIVITY_CREATED,
        expect.objectContaining({ activityId: "activity-1", type: ActivityType.TASK }),
      );
    });

    it("creates a Follow-up and emits the milestone FOLLOW_UP_SCHEDULED, not the generic event", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      activityRepository.create.mockResolvedValue({
        ...baseTask,
        type: ActivityType.FOLLOW_UP,
        status: null,
      } as never);

      await service.create(
        "workspace-1",
        {
          type: ActivityType.FOLLOW_UP,
          customerId: "customer-1",
          followUpDate: "2026-09-01T00:00:00.000Z",
          followUpType: "CALL" as never,
        },
        "user-1",
        TenantRole.OWNER,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.FOLLOW_UP_SCHEDULED,
        expect.anything(),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.ACTIVITY_CREATED,
        expect.anything(),
      );
    });

    it("validates the assignee when assignedUserId is supplied", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.create(
          "workspace-1",
          { type: ActivityType.TASK, customerId: "customer-1", assignedUserId: ASSIGNEE_ID },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("createNote", () => {
    it("creates a Note (type=NOTE) and emits NOTE_ADDED", async () => {
      dealRepository.findByIdForWorkspace.mockResolvedValue({} as never);
      activityRepository.create.mockResolvedValue({
        ...baseTask,
        type: ActivityType.NOTE,
        status: null,
        text: "Customer asked for a discount",
      } as never);

      const result = await service.createNote(
        "workspace-1",
        { dealId: "deal-1", text: "Customer asked for a discount" },
        "user-1",
        TenantRole.OWNER,
      );

      expect(result.text).toBe("Customer asked for a discount");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.NOTE_ADDED,
        expect.objectContaining({ type: ActivityType.NOTE }),
      );
    });
  });

  describe("getById", () => {
    it("throws NotFoundException when the Activity doesn't exist", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(service.getById("workspace-1", "activity-1", TenantRole.OWNER)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when the actor lacks VIEW_DEALS for the referenced Deal", async () => {
      // VIEW_CUSTOMERS has no NONE grant for any TenantRole (every role has
      // at least VIEW_ONLY) — VIEW_DEALS does (MARKETING_EXECUTIVE), so a
      // Deal-referencing Activity is what actually exercises the rejection
      // branch.
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        customerId: null,
        dealId: { toString: () => "deal-1" },
      } as never);

      await expect(
        service.getById("workspace-1", "activity-1", TenantRole.MARKETING_EXECUTIVE),
      ).rejects.toThrow(ForbiddenException);
    });

    it("returns the mapped summary when access is granted", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);

      const result = await service.getById("workspace-1", "activity-1", TenantRole.OWNER);

      expect(result.id).toBe("activity-1");
    });
  });

  describe("list", () => {
    it("rejects when the actor has no role at all", async () => {
      // Every defined TenantRole has at least VIEW_ONLY on VIEW_CUSTOMERS
      // today, so the only reachable rejection case is no role (matches
      // PermissionsGuard's own "no role → forbidden" default elsewhere).
      await expect(service.list("workspace-1", {}, null)).rejects.toThrow(ForbiddenException);
      expect(activityRepository.list).not.toHaveBeenCalled();
    });

    it("lists when the actor has at least one of VIEW_CUSTOMERS/VIEW_DEALS", async () => {
      activityRepository.list.mockResolvedValue({ items: [baseTask as never], total: 1 });

      const result = await service.list("workspace-1", {}, TenantRole.SUPPORT_EXECUTIVE);

      expect(result.items).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("rejects updates to a completed Task (BR-004)", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        status: TaskStatus.COMPLETED,
      } as never);

      await expect(
        service.update(
          "workspace-1",
          "activity-1",
          { title: "New title" },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(activityRepository.update).not.toHaveBeenCalled();
    });

    it("rejects updates to a completed Follow-up (BR-005)", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        type: ActivityType.FOLLOW_UP,
        status: null,
        followUpCompletedAt: new Date(),
      } as never);

      await expect(
        service.update(
          "workspace-1",
          "activity-1",
          { title: "New title" },
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("updates and emits ACTIVITY_UPDATED", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);
      activityRepository.update.mockResolvedValue({ ...baseTask, title: "Updated" } as never);

      const result = await service.update(
        "workspace-1",
        "activity-1",
        { title: "Updated" },
        "user-1",
        TenantRole.OWNER,
      );

      expect(result.title).toBe("Updated");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.ACTIVITY_UPDATED,
        expect.objectContaining({ activityId: "activity-1" }),
      );
    });
  });

  describe("assignTask", () => {
    it("throws NotFoundException when the Activity isn't a Task", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        type: ActivityType.NOTE,
      } as never);

      await expect(
        service.assignTask("workspace-1", "activity-1", ASSIGNEE_ID, "user-1", TenantRole.OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it("assigns to an ACTIVE member (no role restriction) and emits TASK_ASSIGNED", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);
      userRepository.findById.mockResolvedValue(eligibleAssignee as never);
      activityRepository.updateAssignment.mockResolvedValue({
        ...baseTask,
        assignedUserId: ASSIGNEE_ID,
      } as never);

      const result = await service.assignTask(
        "workspace-1",
        "activity-1",
        ASSIGNEE_ID,
        "user-1",
        TenantRole.OWNER,
      );

      expect(result.assignedUserId).toBe(ASSIGNEE_ID);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.TASK_ASSIGNED,
        expect.objectContaining({ assignedUserId: ASSIGNEE_ID }),
      );
    });

    it("unassigns and emits TASK_UNASSIGNED", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        assignedUserId: ASSIGNEE_ID,
      } as never);
      activityRepository.updateAssignment.mockResolvedValue({
        ...baseTask,
        assignedUserId: null,
      } as never);

      const result = await service.assignTask(
        "workspace-1",
        "activity-1",
        null,
        "user-1",
        TenantRole.OWNER,
      );

      expect(result.assignedUserId).toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.TASK_UNASSIGNED,
        expect.anything(),
      );
    });

    it("rejects an inactive assignee", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);
      userRepository.findById.mockResolvedValue({
        ...eligibleAssignee,
        workspaceMemberStatus: WorkspaceMemberStatus.SUSPENDED,
      } as never);

      await expect(
        service.assignTask("workspace-1", "activity-1", ASSIGNEE_ID, "user-1", TenantRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a malformed assignee id without querying the database", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);

      await expect(
        service.assignTask(
          "workspace-1",
          "activity-1",
          "not-a-real-id",
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(userRepository.findById).not.toHaveBeenCalled();
    });

    it("rejects assigning an already-completed Task", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        status: TaskStatus.COMPLETED,
      } as never);

      await expect(
        service.assignTask("workspace-1", "activity-1", ASSIGNEE_ID, "user-1", TenantRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("assignFollowUp", () => {
    it("throws NotFoundException when the Activity isn't a Follow-up", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);

      await expect(
        service.assignFollowUp(
          "workspace-1",
          "activity-1",
          ASSIGNEE_ID,
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("assigns and emits FOLLOW_UP_ASSIGNED", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        type: ActivityType.FOLLOW_UP,
        status: null,
      } as never);
      userRepository.findById.mockResolvedValue(eligibleAssignee as never);
      activityRepository.updateAssignment.mockResolvedValue({
        ...baseTask,
        type: ActivityType.FOLLOW_UP,
        assignedUserId: ASSIGNEE_ID,
      } as never);

      await service.assignFollowUp(
        "workspace-1",
        "activity-1",
        ASSIGNEE_ID,
        "user-1",
        TenantRole.OWNER,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.FOLLOW_UP_ASSIGNED,
        expect.anything(),
      );
    });
  });

  describe("updateTaskStatus", () => {
    it("throws NotFoundException when the Activity isn't a Task", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        type: ActivityType.CALL,
      } as never);

      await expect(
        service.updateTaskStatus(
          "workspace-1",
          "activity-1",
          TaskStatus.IN_PROGRESS,
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("emits the generic ACTIVITY_UPDATED for a non-completion transition", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);
      activityRepository.updateTaskStatus.mockResolvedValue({
        ...baseTask,
        status: TaskStatus.IN_PROGRESS,
      } as never);

      await service.updateTaskStatus(
        "workspace-1",
        "activity-1",
        TaskStatus.IN_PROGRESS,
        "user-1",
        TenantRole.OWNER,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.ACTIVITY_UPDATED,
        expect.anything(),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        DomainEvent.TASK_COMPLETED,
        expect.anything(),
      );
    });

    it("emits TASK_COMPLETED when status moves to COMPLETED", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);
      activityRepository.updateTaskStatus.mockResolvedValue({
        ...baseTask,
        status: TaskStatus.COMPLETED,
      } as never);

      const result = await service.updateTaskStatus(
        "workspace-1",
        "activity-1",
        TaskStatus.COMPLETED,
        "user-1",
        TenantRole.OWNER,
      );

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.TASK_COMPLETED,
        expect.objectContaining({ activityId: "activity-1" }),
      );
    });

    it("rejects a status change on an already-completed Task", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        status: TaskStatus.COMPLETED,
      } as never);

      await expect(
        service.updateTaskStatus(
          "workspace-1",
          "activity-1",
          TaskStatus.CANCELLED,
          "user-1",
          TenantRole.OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("completeFollowUp", () => {
    it("throws NotFoundException when the Activity isn't a Follow-up", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);

      await expect(
        service.completeFollowUp("workspace-1", "activity-1", "user-1", TenantRole.OWNER),
      ).rejects.toThrow(NotFoundException);
    });

    it("completes and emits FOLLOW_UP_COMPLETED", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        type: ActivityType.FOLLOW_UP,
        status: null,
      } as never);
      activityRepository.completeFollowUp.mockResolvedValue({
        ...baseTask,
        type: ActivityType.FOLLOW_UP,
        followUpCompletedAt: new Date(),
      } as never);

      const result = await service.completeFollowUp(
        "workspace-1",
        "activity-1",
        "user-1",
        TenantRole.OWNER,
      );

      expect(result.followUpCompletedAt).not.toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.FOLLOW_UP_COMPLETED,
        expect.objectContaining({ activityId: "activity-1" }),
      );
    });

    it("rejects completing an already-completed Follow-up", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        type: ActivityType.FOLLOW_UP,
        status: null,
        followUpCompletedAt: new Date(),
      } as never);

      await expect(
        service.completeFollowUp("workspace-1", "activity-1", "user-1", TenantRole.OWNER),
      ).rejects.toThrow(BadRequestException);
      expect(activityRepository.completeFollowUp).not.toHaveBeenCalled();
    });
  });

  describe("archive", () => {
    it("archives and emits ACTIVITY_ARCHIVED", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue(baseTask as never);
      activityRepository.archive.mockResolvedValue({
        ...baseTask,
        archivedAt: new Date(),
      } as never);

      const result = await service.archive("workspace-1", "activity-1", "user-1", TenantRole.OWNER);

      expect(result.archivedAt).not.toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.ACTIVITY_ARCHIVED,
        expect.objectContaining({ activityId: "activity-1", actorId: "user-1" }),
      );
    });

    it("rejects archiving an already-archived Activity", async () => {
      activityRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseTask,
        archivedAt: new Date(),
      } as never);

      await expect(
        service.archive("workspace-1", "activity-1", "user-1", TenantRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
