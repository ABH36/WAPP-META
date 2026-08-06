import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { LeadSource, LeadStatus, TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";
import { LeadService } from "./lead.service.js";
import { LeadRepository } from "../repositories/lead.repository.js";
import { ContactRepository } from "../../communication/repositories/contact.repository.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const baseLead = {
  _id: { toString: () => "lead-1" },
  workspaceId: "workspace-1",
  contactId: { toString: () => "contact-1" },
  customerId: null,
  leadName: "Acme Opportunity",
  mobileNumber: "+919876543210",
  source: LeadSource.MANUAL_ENTRY,
  status: LeadStatus.NEW,
  company: null,
  email: null,
  industry: null,
  expectedValue: null,
  notes: null,
  assignedUserId: null,
  archivedAt: null,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: new Date("2026-08-06T00:00:00.000Z"),
  updatedAt: new Date("2026-08-06T00:00:00.000Z"),
};

const salesExecutive = {
  _id: { toString: () => "user-2" },
  workspaceId: "workspace-1",
  workspaceMemberStatus: WorkspaceMemberStatus.ACTIVE,
  role: TenantRole.SALES_EXECUTIVE,
};

describe("LeadService", () => {
  let service: LeadService;
  let leadRepository: jest.Mocked<LeadRepository>;
  let contactRepository: jest.Mocked<ContactRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadService,
        {
          provide: LeadRepository,
          useValue: {
            create: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            findActiveByContactForWorkspace: jest.fn(),
            list: jest.fn(),
            update: jest.fn(),
            updateAssignment: jest.fn(),
            updateStatus: jest.fn(),
            archive: jest.fn(),
          },
        },
        {
          provide: ContactRepository,
          useValue: { findOrCreate: jest.fn(), findByIdForWorkspace: jest.fn() },
        },
        {
          provide: CustomerRepository,
          useValue: { findByIdForWorkspace: jest.fn(), findByContactForWorkspace: jest.fn() },
        },
        { provide: UserRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(LeadService);
    leadRepository = moduleRef.get(LeadRepository);
    contactRepository = moduleRef.get(ContactRepository);
    customerRepository = moduleRef.get(CustomerRepository);
    userRepository = moduleRef.get(UserRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("Method 1 (mobileNumber): resolves/creates the Contact, no Customer link", async () => {
      contactRepository.findOrCreate.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue(null);
      leadRepository.findActiveByContactForWorkspace.mockResolvedValue(null);
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      leadRepository.create.mockResolvedValue(baseLead as never);

      const result = await service.create(
        "workspace-1",
        {
          leadName: "Acme Opportunity",
          mobileNumber: "+919876543210",
          source: LeadSource.MANUAL_ENTRY,
        },
        "user-1",
      );

      expect(contactRepository.findOrCreate).toHaveBeenCalledWith(
        "workspace-1",
        "+919876543210",
        null,
      );
      expect(leadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "contact-1", customerId: null }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.LEAD_CREATED,
        expect.objectContaining({ contactId: "contact-1", customerId: null }),
      );
      expect(result.id).toBe("lead-1");
    });

    it("auto-links an existing Customer for the resolved Contact (§11)", async () => {
      contactRepository.findOrCreate.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue({
        _id: { toString: () => "customer-1" },
      } as never);
      leadRepository.findActiveByContactForWorkspace.mockResolvedValue(null);
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      leadRepository.create.mockResolvedValue({
        ...baseLead,
        customerId: { toString: () => "customer-1" },
      } as never);

      await service.create(
        "workspace-1",
        {
          leadName: "Acme Opportunity",
          mobileNumber: "+919876543210",
          source: LeadSource.MANUAL_ENTRY,
        },
        "user-1",
      );

      expect(leadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: "customer-1" }),
      );
    });

    it("Method 2 (contactId): validates the Contact and sources WHATSAPP", async () => {
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue(null);
      leadRepository.findActiveByContactForWorkspace.mockResolvedValue(null);
      leadRepository.create.mockResolvedValue({
        ...baseLead,
        source: LeadSource.WHATSAPP,
      } as never);

      await service.create(
        "workspace-1",
        { leadName: "Acme Opportunity", contactId: "contact-1", source: LeadSource.WHATSAPP },
        "user-1",
      );

      expect(contactRepository.findOrCreate).not.toHaveBeenCalled();
      expect(leadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "contact-1", source: LeadSource.WHATSAPP }),
      );
    });

    it("Method 2: throws NotFoundException when the Contact doesn't exist", async () => {
      contactRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(
        service.create(
          "workspace-1",
          { leadName: "Acme Opportunity", contactId: "missing", source: LeadSource.WHATSAPP },
          "user-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("Method 3 (customerId): uses the Customer's own Contact and links customerId directly", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "customer-1" },
        contactId: { toString: () => "contact-1" },
      } as never);
      leadRepository.findActiveByContactForWorkspace.mockResolvedValue(null);
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      leadRepository.create.mockResolvedValue({
        ...baseLead,
        customerId: { toString: () => "customer-1" },
        source: LeadSource.EXISTING_CUSTOMER,
      } as never);

      await service.create(
        "workspace-1",
        { leadName: "Upsell", customerId: "customer-1", source: LeadSource.EXISTING_CUSTOMER },
        "user-1",
      );

      expect(customerRepository.findByContactForWorkspace).not.toHaveBeenCalled();
      expect(leadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "contact-1", customerId: "customer-1" }),
      );
    });

    it("Method 3: throws NotFoundException when the Customer doesn't exist", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(
        service.create(
          "workspace-1",
          { leadName: "Upsell", customerId: "missing", source: LeadSource.EXISTING_CUSTOMER },
          "user-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("prioritizes customerId over contactId and mobileNumber when more than one is supplied", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "customer-1" },
        contactId: { toString: () => "contact-1" },
      } as never);
      leadRepository.findActiveByContactForWorkspace.mockResolvedValue(null);
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      leadRepository.create.mockResolvedValue(baseLead as never);

      await service.create(
        "workspace-1",
        {
          leadName: "Upsell",
          customerId: "customer-1",
          contactId: "contact-other",
          mobileNumber: "+910000000000",
          source: LeadSource.EXISTING_CUSTOMER,
        },
        "user-1",
      );

      expect(contactRepository.findOrCreate).not.toHaveBeenCalled();
      expect(customerRepository.findByIdForWorkspace).toHaveBeenCalledWith(
        "workspace-1",
        "customer-1",
      );
    });

    it("throws ConflictException when an active Lead already exists for the Contact", async () => {
      contactRepository.findOrCreate.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue(null);
      leadRepository.findActiveByContactForWorkspace.mockResolvedValue(baseLead as never);

      await expect(
        service.create(
          "workspace-1",
          {
            leadName: "Acme Opportunity",
            mobileNumber: "+919876543210",
            source: LeadSource.MANUAL_ENTRY,
          },
          "user-1",
        ),
      ).rejects.toThrow(ConflictException);
      expect(leadRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("rejects updates to an archived Lead", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        archivedAt: new Date(),
      } as never);

      await expect(
        service.update("workspace-1", "lead-1", { company: "Acme Inc" }, "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(leadRepository.update).not.toHaveBeenCalled();
    });

    it("emits LEAD_UPDATED on success", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
      leadRepository.update.mockResolvedValue({ ...baseLead, company: "Acme Inc" } as never);

      const result = await service.update(
        "workspace-1",
        "lead-1",
        { company: "Acme Inc" },
        "user-1",
      );

      expect(result.company).toBe("Acme Inc");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.LEAD_UPDATED,
        expect.objectContaining({ leadId: "lead-1", updatedBy: "user-1" }),
      );
    });

    it("rejects updates to a converted Lead (BR-006)", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        convertedAt: new Date(),
      } as never);

      await expect(
        service.update("workspace-1", "lead-1", { company: "Acme Inc" }, "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(leadRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("assign", () => {
    it("assigns to an eligible Sales Executive and emits LEAD_ASSIGNED", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
      userRepository.findById.mockResolvedValue(salesExecutive as never);
      leadRepository.updateAssignment.mockResolvedValue({
        ...baseLead,
        assignedUserId: "user-2",
      } as never);

      const result = await service.assign("workspace-1", "lead-1", "user-2", "user-1");

      expect(result.assignedUserId).toBe("user-2");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.LEAD_ASSIGNED,
        expect.objectContaining({ assignedUserId: "user-2", actorId: "user-1" }),
      );
    });

    it("unassigns when assignedUserId is null and emits LEAD_UNASSIGNED", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        assignedUserId: "user-2",
      } as never);
      leadRepository.updateAssignment.mockResolvedValue({
        ...baseLead,
        assignedUserId: null,
      } as never);

      await service.assign("workspace-1", "lead-1", null, "user-1");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.LEAD_UNASSIGNED,
        expect.objectContaining({ assignedUserId: null }),
      );
    });

    it("rejects an assignee outside the workspace or not ACTIVE", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
      userRepository.findById.mockResolvedValue({
        ...salesExecutive,
        workspaceId: "workspace-2",
      } as never);

      await expect(service.assign("workspace-1", "lead-1", "user-2", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects an assignee who isn't a Sales Executive", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
      userRepository.findById.mockResolvedValue({
        ...salesExecutive,
        role: TenantRole.SALES_MANAGER,
      } as never);

      await expect(service.assign("workspace-1", "lead-1", "user-2", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects assignment on an archived Lead", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        archivedAt: new Date(),
      } as never);

      await expect(service.assign("workspace-1", "lead-1", "user-2", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects assignment on a converted Lead (BR-006)", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        convertedAt: new Date(),
      } as never);

      await expect(service.assign("workspace-1", "lead-1", "user-2", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateStatus", () => {
    it("allows a legal transition (NEW -> CONTACTED) and emits the generic LEAD_STATUS_CHANGED", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
      leadRepository.updateStatus.mockResolvedValue({
        ...baseLead,
        status: LeadStatus.CONTACTED,
      } as never);

      const result = await service.updateStatus(
        "workspace-1",
        "lead-1",
        LeadStatus.CONTACTED,
        "user-1",
      );

      expect(result.status).toBe(LeadStatus.CONTACTED);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.LEAD_STATUS_CHANGED,
        expect.objectContaining({
          previousStatus: LeadStatus.NEW,
          newStatus: LeadStatus.CONTACTED,
        }),
      );
    });

    it.each([
      [LeadStatus.CONTACTED, LeadStatus.QUALIFIED, DomainEvent.LEAD_QUALIFIED],
      [LeadStatus.NEGOTIATION, LeadStatus.WON, DomainEvent.LEAD_WON],
      [LeadStatus.NEGOTIATION, LeadStatus.LOST, DomainEvent.LEAD_LOST],
    ])("emits the milestone event for %s -> %s", async (from, target, event) => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        status: from,
      } as never);
      leadRepository.updateStatus.mockResolvedValue({ ...baseLead, status: target } as never);

      await service.updateStatus("workspace-1", "lead-1", target, "user-1");

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        event,
        expect.objectContaining({ newStatus: target }),
      );
    });

    it("rejects an illegal transition (WON is terminal)", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        status: LeadStatus.WON,
      } as never);

      await expect(
        service.updateStatus("workspace-1", "lead-1", LeadStatus.CONTACTED, "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(leadRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects a status change on an archived Lead", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        archivedAt: new Date(),
      } as never);

      await expect(
        service.updateStatus("workspace-1", "lead-1", LeadStatus.CONTACTED, "user-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a status change on a converted Lead (BR-006)", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        status: LeadStatus.WON,
        convertedAt: new Date(),
      } as never);

      await expect(
        service.updateStatus("workspace-1", "lead-1", LeadStatus.LOST, "user-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("archive", () => {
    it("archives and emits LEAD_ARCHIVED", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
      leadRepository.archive.mockResolvedValue({
        ...baseLead,
        archivedAt: new Date(),
      } as never);

      const result = await service.archive("workspace-1", "lead-1", "user-1");

      expect(result.archivedAt).not.toBeNull();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.LEAD_ARCHIVED,
        expect.objectContaining({ leadId: "lead-1", actorId: "user-1" }),
      );
    });

    it("rejects archiving an already-archived Lead", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        archivedAt: new Date(),
      } as never);

      await expect(service.archive("workspace-1", "lead-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects archiving a converted Lead (BR-006)", async () => {
      leadRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseLead,
        convertedAt: new Date(),
      } as never);

      await expect(service.archive("workspace-1", "lead-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
