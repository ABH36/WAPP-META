import { Test } from "@nestjs/testing";
import { AuditLogListener } from "./audit-log.listener.js";
import { AuditLogRepository } from "../repositories/audit-log.repository.js";
import { AuditCategory, AuditResult } from "../schemas/audit-log-entry.schema.js";

describe("AuditLogListener", () => {
  let listener: AuditLogListener;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLogListener,
        { provide: AuditLogRepository, useValue: { record: jest.fn() } },
      ],
    }).compile();

    listener = moduleRef.get(AuditLogListener);
    auditLogRepository = moduleRef.get(AuditLogRepository);
  });

  it("records a CRM entry with the acting user as actor", async () => {
    await listener.onCustomerCreated({
      workspaceId: "workspace-1",
      customerId: "customer-1",
      contactId: "contact-1",
      source: "MANUAL",
      createdBy: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(auditLogRepository.record).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      category: AuditCategory.CRM,
      actorId: "user-1",
      module: "CRM",
      entity: "Customer",
      entityId: "customer-1",
      action: "Customer Created",
      result: AuditResult.SUCCESS,
      metadata: null,
    });
  });

  it("records a system-initiated Billing entry with a null actor", async () => {
    await listener.onSubscriptionCreated({
      workspaceId: "workspace-1",
      subscriptionId: "sub-1",
      planId: "plan-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(auditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null, category: AuditCategory.BILLING }),
    );
  });

  it("records a payment failure with result=FAILURE", async () => {
    await listener.onPaymentFailed({
      workspaceId: "workspace-1",
      paymentId: "payment-1",
      invoiceId: "invoice-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(auditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: AuditResult.FAILURE, action: "Payment Failed" }),
    );
  });

  it("records an integration event using the integrationType as entity", async () => {
    await listener.onIntegrationDisconnected({
      workspaceId: "workspace-1",
      integrationType: "WHATSAPP",
      actorId: "user-1",
      occurredAt: "2026-08-08T00:00:00.000Z",
    });

    expect(auditLogRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: AuditCategory.INTEGRATIONS,
        entity: "WHATSAPP",
        action: "Integration Disconnected",
      }),
    );
  });
});
