import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CustomerSource, CustomerStatus } from "@wapp/shared-types";
import { CustomerService } from "./customer.service.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { ContactRepository } from "../../communication/repositories/contact.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";

const baseCustomer = {
  _id: { toString: () => "customer-1" },
  workspaceId: "workspace-1",
  contactId: { toString: () => "contact-1" },
  customerName: "Acme Retail",
  mobileNumber: "+919876543210",
  status: CustomerStatus.ACTIVE,
  source: CustomerSource.MANUAL_ENTRY,
  companyName: null,
  email: null,
  gstNumber: null,
  address: null,
  city: null,
  state: null,
  country: null,
  postalCode: null,
  website: null,
  industry: null,
  notes: null,
  createdBy: "user-1",
  updatedBy: "user-1",
  createdAt: new Date("2026-08-06T00:00:00.000Z"),
  updatedAt: new Date("2026-08-06T00:00:00.000Z"),
};

describe("CustomerService", () => {
  let service: CustomerService;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let contactRepository: jest.Mocked<ContactRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: CustomerRepository,
          useValue: {
            create: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            findByContactForWorkspace: jest.fn(),
            list: jest.fn(),
            update: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: ContactRepository,
          useValue: { findOrCreate: jest.fn(), findByIdForWorkspace: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(CustomerService);
    customerRepository = moduleRef.get(CustomerRepository);
    contactRepository = moduleRef.get(ContactRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("Method 1 (mobileNumber): resolves/creates the Contact and sources MANUAL_ENTRY", async () => {
      contactRepository.findOrCreate.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue(null);
      customerRepository.create.mockResolvedValue(baseCustomer as never);

      const result = await service.create(
        "workspace-1",
        { customerName: "Acme Retail", mobileNumber: "+919876543210" },
        "user-1",
      );

      expect(contactRepository.findOrCreate).toHaveBeenCalledWith(
        "workspace-1",
        "+919876543210",
        null,
      );
      expect(customerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "contact-1", source: CustomerSource.MANUAL_ENTRY }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.CUSTOMER_CREATED,
        expect.objectContaining({ source: CustomerSource.MANUAL_ENTRY, contactId: "contact-1" }),
      );
      expect(result.id).toBe("customer-1");
    });

    it("Method 3 (contactId): validates the Contact and sources WHATSAPP", async () => {
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue(null);
      customerRepository.create.mockResolvedValue({
        ...baseCustomer,
        source: CustomerSource.WHATSAPP,
      } as never);

      await service.create(
        "workspace-1",
        { customerName: "Acme Retail", contactId: "contact-1" },
        "user-1",
      );

      expect(contactRepository.findOrCreate).not.toHaveBeenCalled();
      expect(customerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "contact-1", source: CustomerSource.WHATSAPP }),
      );
    });

    it("Method 3: throws NotFoundException when the Contact doesn't exist", async () => {
      contactRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(
        service.create(
          "workspace-1",
          { customerName: "Acme Retail", contactId: "missing" },
          "user-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("prioritizes contactId (Method 3) when both contactId and mobileNumber are supplied", async () => {
      contactRepository.findByIdForWorkspace.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue(null);
      customerRepository.create.mockResolvedValue(baseCustomer as never);

      await service.create(
        "workspace-1",
        { customerName: "Acme Retail", contactId: "contact-1", mobileNumber: "+910000000000" },
        "user-1",
      );

      expect(contactRepository.findOrCreate).not.toHaveBeenCalled();
      expect(contactRepository.findByIdForWorkspace).toHaveBeenCalledWith(
        "workspace-1",
        "contact-1",
      );
    });

    it("throws ConflictException when a Customer already exists for the Contact", async () => {
      contactRepository.findOrCreate.mockResolvedValue({
        _id: { toString: () => "contact-1" },
        phoneNumber: "+919876543210",
      } as never);
      customerRepository.findByContactForWorkspace.mockResolvedValue(baseCustomer as never);

      await expect(
        service.create(
          "workspace-1",
          { customerName: "Acme Retail", mobileNumber: "+919876543210" },
          "user-1",
        ),
      ).rejects.toThrow(ConflictException);
      expect(customerRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("throws NotFoundException when the Customer doesn't exist", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue(null);

      await expect(service.getById("workspace-1", "missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the mapped summary when found", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue(baseCustomer as never);

      const result = await service.getById("workspace-1", "customer-1");

      expect(result.customerName).toBe("Acme Retail");
    });
  });

  describe("update", () => {
    it("emits CUSTOMER_UPDATED on success", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue(baseCustomer as never);
      customerRepository.update.mockResolvedValue({
        ...baseCustomer,
        companyName: "Acme Inc",
      } as never);

      const result = await service.update(
        "workspace-1",
        "customer-1",
        { companyName: "Acme Inc" },
        "user-1",
      );

      expect(result.companyName).toBe("Acme Inc");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.CUSTOMER_UPDATED,
        expect.objectContaining({ customerId: "customer-1", updatedBy: "user-1" }),
      );
    });

    it("allows updates while BLOCKED (Customer Editing Policy — ADR-CRM-004)", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseCustomer,
        status: CustomerStatus.BLOCKED,
      } as never);
      customerRepository.update.mockResolvedValue({
        ...baseCustomer,
        status: CustomerStatus.BLOCKED,
        companyName: "Acme Inc",
      } as never);

      const result = await service.update(
        "workspace-1",
        "customer-1",
        { companyName: "Acme Inc" },
        "user-1",
      );

      expect(result.companyName).toBe("Acme Inc");
    });

    it("rejects updates to an ARCHIVED Customer (Customer Editing Policy — ADR-CRM-004)", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseCustomer,
        status: CustomerStatus.ARCHIVED,
      } as never);

      await expect(
        service.update("workspace-1", "customer-1", { companyName: "Acme Inc" }, "user-1"),
      ).rejects.toThrow(BadRequestException);
      expect(customerRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("lifecycle transitions", () => {
    it("block: ACTIVE -> BLOCKED succeeds and emits CUSTOMER_BLOCKED", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue(baseCustomer as never);
      customerRepository.updateStatus.mockResolvedValue({
        ...baseCustomer,
        status: CustomerStatus.BLOCKED,
      } as never);

      const result = await service.block("workspace-1", "customer-1", "user-1");

      expect(result.status).toBe(CustomerStatus.BLOCKED);
      expect(customerRepository.updateStatus).toHaveBeenCalledWith(
        "workspace-1",
        "customer-1",
        CustomerStatus.BLOCKED,
        "user-1",
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.CUSTOMER_BLOCKED,
        expect.objectContaining({
          previousStatus: CustomerStatus.ACTIVE,
          newStatus: CustomerStatus.BLOCKED,
          actorId: "user-1",
        }),
      );
    });

    it("block: rejects a Customer that isn't ACTIVE", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseCustomer,
        status: CustomerStatus.ARCHIVED,
      } as never);

      await expect(service.block("workspace-1", "customer-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(customerRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("activate: BLOCKED -> ACTIVE succeeds", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseCustomer,
        status: CustomerStatus.BLOCKED,
      } as never);
      customerRepository.updateStatus.mockResolvedValue(baseCustomer as never);

      const result = await service.activate("workspace-1", "customer-1", "user-1");

      expect(result.status).toBe(CustomerStatus.ACTIVE);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.CUSTOMER_ACTIVATED,
        expect.objectContaining({ previousStatus: CustomerStatus.BLOCKED }),
      );
    });

    it("activate: rejects a Customer that isn't BLOCKED", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue(baseCustomer as never);

      await expect(service.activate("workspace-1", "customer-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([CustomerStatus.ACTIVE, CustomerStatus.BLOCKED])(
      "archive: %s -> ARCHIVED succeeds",
      async (fromStatus) => {
        customerRepository.findByIdForWorkspace.mockResolvedValue({
          ...baseCustomer,
          status: fromStatus,
        } as never);
        customerRepository.updateStatus.mockResolvedValue({
          ...baseCustomer,
          status: CustomerStatus.ARCHIVED,
        } as never);

        const result = await service.archive("workspace-1", "customer-1", "user-1");

        expect(result.status).toBe(CustomerStatus.ARCHIVED);
        expect(eventEmitter.emit).toHaveBeenCalledWith(
          DomainEvent.CUSTOMER_ARCHIVED,
          expect.objectContaining({
            previousStatus: fromStatus,
            newStatus: CustomerStatus.ARCHIVED,
          }),
        );
      },
    );

    it("archive: rejects an already-ARCHIVED Customer (terminal)", async () => {
      customerRepository.findByIdForWorkspace.mockResolvedValue({
        ...baseCustomer,
        status: CustomerStatus.ARCHIVED,
      } as never);

      await expect(service.archive("workspace-1", "customer-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("list", () => {
    it("applies pagination defaults and maps results", async () => {
      customerRepository.list.mockResolvedValue({ items: [baseCustomer as never], total: 1 });

      const result = await service.list("workspace-1", {});

      expect(customerRepository.list).toHaveBeenCalledWith(
        "workspace-1",
        { status: undefined, source: undefined, q: undefined },
        "createdAt",
        -1,
        1,
        25,
      );
      expect(result.items).toHaveLength(1);
      expect(result.meta.totalRecords).toBe(1);
    });
  });
});
