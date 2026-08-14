import { Test } from "@nestjs/testing";
import { getConnectionToken } from "@nestjs/mongoose";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CustomerSource, LeadStatus, WorkspaceStatus } from "@wapp/shared-types";
import { LeadConversionService } from "./lead-conversion.service.js";
import { LeadRepository } from "../repositories/lead.repository.js";
import { CustomerRepository } from "../repositories/customer.repository.js";
import { DealRepository } from "../repositories/deal.repository.js";
import { WorkspaceRepository } from "../../workspace/repositories/workspace.repository.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import { MetricsService } from "../../../common/metrics/metrics.service.js";

const baseLead = {
  _id: { toString: () => "lead-1" },
  workspaceId: "workspace-1",
  contactId: { toString: () => "contact-1" },
  customerId: null as { toString(): string } | null,
  leadName: "Acme Opportunity",
  mobileNumber: "+919876543210",
  company: "Acme Inc",
  email: "acme@example.com",
  industry: "Retail",
  status: LeadStatus.WON,
  archivedAt: null as Date | null,
  convertedAt: null as Date | null,
  dealId: null as { toString(): string } | null,
};

const activeWorkspace = { _id: "workspace-1", status: WorkspaceStatus.ACTIVE };

describe("LeadConversionService", () => {
  let service: LeadConversionService;
  let leadRepository: jest.Mocked<LeadRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;
  let dealRepository: jest.Mocked<DealRepository>;
  let workspaceRepository: jest.Mocked<WorkspaceRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let mockSession: { withTransaction: jest.Mock; endSession: jest.Mock };
  let mockConnection: { startSession: jest.Mock };

  beforeEach(async () => {
    mockSession = {
      withTransaction: jest.fn(async (fn: () => Promise<void>) => {
        await fn();
      }),
      endSession: jest.fn(),
    };
    mockConnection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadConversionService,
        { provide: getConnectionToken(), useValue: mockConnection },
        {
          provide: LeadRepository,
          useValue: { findByIdForWorkspace: jest.fn(), markConverted: jest.fn() },
        },
        { provide: CustomerRepository, useValue: { create: jest.fn() } },
        { provide: DealRepository, useValue: { create: jest.fn() } },
        { provide: WorkspaceRepository, useValue: { findById: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        MetricsService,
      ],
    }).compile();

    service = moduleRef.get(LeadConversionService);
    leadRepository = moduleRef.get(LeadRepository);
    customerRepository = moduleRef.get(CustomerRepository);
    dealRepository = moduleRef.get(DealRepository);
    workspaceRepository = moduleRef.get(WorkspaceRepository);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("throws NotFoundException when the Lead doesn't exist", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue(null);

    await expect(service.convert("workspace-1", "lead-1", "user-1")).rejects.toThrow(
      NotFoundException,
    );
    expect(mockConnection.startSession).not.toHaveBeenCalled();
  });

  it("throws ConflictException with the existing conversion data when already converted (idempotency)", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue({
      ...baseLead,
      customerId: { toString: () => "customer-1" },
      dealId: { toString: () => "deal-1" },
      convertedAt: new Date("2026-08-06T00:00:00.000Z"),
    } as never);

    await expect(service.convert("workspace-1", "lead-1", "user-1")).rejects.toThrow(
      ConflictException,
    );
    expect(mockConnection.startSession).not.toHaveBeenCalled();
    expect(dealRepository.create).not.toHaveBeenCalled();
  });

  it("throws BadRequestException for an archived Lead", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue({
      ...baseLead,
      archivedAt: new Date(),
    } as never);

    await expect(service.convert("workspace-1", "lead-1", "user-1")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws BadRequestException when the Lead isn't WON", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue({
      ...baseLead,
      status: LeadStatus.NEGOTIATION,
    } as never);

    await expect(service.convert("workspace-1", "lead-1", "user-1")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("throws NotFoundException when the Workspace doesn't exist", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
    workspaceRepository.findById.mockResolvedValue(null);

    await expect(service.convert("workspace-1", "lead-1", "user-1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequestException when the Workspace is read-only (EXPIRED)", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
    workspaceRepository.findById.mockResolvedValue({
      ...activeWorkspace,
      status: WorkspaceStatus.EXPIRED,
    } as never);

    await expect(service.convert("workspace-1", "lead-1", "user-1")).rejects.toThrow(
      BadRequestException,
    );
    expect(mockConnection.startSession).not.toHaveBeenCalled();
  });

  it("allows conversion for a TRIAL workspace (full access, not just ACTIVE)", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue({
      ...baseLead,
      customerId: { toString: () => "customer-1" },
    } as never);
    workspaceRepository.findById.mockResolvedValue({
      ...activeWorkspace,
      status: WorkspaceStatus.TRIAL,
    } as never);
    dealRepository.create.mockResolvedValue({ _id: { toString: () => "deal-1" } } as never);
    leadRepository.markConverted.mockResolvedValue({ ...baseLead } as never);

    const result = await service.convert("workspace-1", "lead-1", "user-1");

    expect(result.dealId).toBe("deal-1");
  });

  it("reuses an already-linked Customer without creating a new one", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue({
      ...baseLead,
      customerId: { toString: () => "customer-1" },
    } as never);
    workspaceRepository.findById.mockResolvedValue(activeWorkspace as never);
    dealRepository.create.mockResolvedValue({ _id: { toString: () => "deal-1" } } as never);
    leadRepository.markConverted.mockResolvedValue({ ...baseLead } as never);

    const result = await service.convert("workspace-1", "lead-1", "user-1");

    expect(customerRepository.create).not.toHaveBeenCalled();
    expect(result.customerId).toBe("customer-1");
    expect(dealRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "customer-1", sourceLeadId: "lead-1" }),
      mockSession,
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      DomainEvent.CUSTOMER_CREATED_FROM_LEAD,
      expect.anything(),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.DEAL_CREATED_FROM_LEAD,
      expect.objectContaining({ dealId: "deal-1", customerId: "customer-1" }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.LEAD_CONVERTED,
      expect.objectContaining({ leadId: "lead-1", customerId: "customer-1", dealId: "deal-1" }),
    );
  });

  it("creates a new Customer (source=LEAD_CONVERSION) when the Lead has none, and emits CUSTOMER_CREATED_FROM_LEAD", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue(baseLead as never);
    workspaceRepository.findById.mockResolvedValue(activeWorkspace as never);
    customerRepository.create.mockResolvedValue({
      _id: { toString: () => "customer-new" },
    } as never);
    dealRepository.create.mockResolvedValue({ _id: { toString: () => "deal-1" } } as never);
    leadRepository.markConverted.mockResolvedValue({ ...baseLead } as never);

    const result = await service.convert("workspace-1", "lead-1", "user-1");

    expect(customerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: "contact-1",
        customerName: "Acme Opportunity",
        source: CustomerSource.LEAD_CONVERSION,
      }),
      mockSession,
    );
    expect(result.customerId).toBe("customer-new");
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      DomainEvent.CUSTOMER_CREATED_FROM_LEAD,
      expect.objectContaining({ customerId: "customer-new", sourceLeadId: "lead-1" }),
    );
    // The Lead itself must also learn about its new Customer link, not
    // just the Deal — otherwise GET /crm/leads/:id keeps showing
    // customerId: null forever after conversion.
    expect(leadRepository.markConverted).toHaveBeenCalledWith(
      "workspace-1",
      "lead-1",
      "customer-new",
      "deal-1",
      "user-1",
      mockSession,
    );
  });

  it("marks the Lead converted inside the same transaction session", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue({
      ...baseLead,
      customerId: { toString: () => "customer-1" },
    } as never);
    workspaceRepository.findById.mockResolvedValue(activeWorkspace as never);
    dealRepository.create.mockResolvedValue({ _id: { toString: () => "deal-1" } } as never);
    leadRepository.markConverted.mockResolvedValue({ ...baseLead } as never);

    await service.convert("workspace-1", "lead-1", "user-1");

    expect(leadRepository.markConverted).toHaveBeenCalledWith(
      "workspace-1",
      "lead-1",
      "customer-1",
      "deal-1",
      "user-1",
      mockSession,
    );
  });

  it("always ends the session, even when the transaction throws", async () => {
    leadRepository.findByIdForWorkspace.mockResolvedValue({
      ...baseLead,
      customerId: { toString: () => "customer-1" },
    } as never);
    workspaceRepository.findById.mockResolvedValue(activeWorkspace as never);
    mockSession.withTransaction.mockRejectedValue(new Error("transient transaction error"));

    await expect(service.convert("workspace-1", "lead-1", "user-1")).rejects.toThrow(
      "transient transaction error",
    );
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
