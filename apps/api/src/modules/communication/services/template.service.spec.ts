import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { TemplateService } from "./template.service.js";
import { TemplateRepository } from "../repositories/template.repository.js";
import { WhatsAppConnectionRepository } from "../repositories/whatsapp-connection.repository.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { MetaApiClient } from "./meta-api-client.service.js";
import { TemplateCategory, TemplateStatus } from "../schemas/template.schema.js";

describe("TemplateService", () => {
  let service: TemplateService;
  let templateRepository: jest.Mocked<TemplateRepository>;
  let connectionRepository: jest.Mocked<WhatsAppConnectionRepository>;
  let tokenEncryption: jest.Mocked<TokenEncryptionService>;
  let metaApiClient: jest.Mocked<MetaApiClient>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TemplateService,
        {
          provide: TemplateRepository,
          useValue: {
            create: jest.fn(),
            findByIdForWorkspace: jest.fn(),
            findByWorkspace: jest.fn(),
            markSubmitted: jest.fn(),
            upsertFromMetaSync: jest.fn(),
            updateStatus: jest.fn(),
            findByMetaTemplateId: jest.fn(),
          },
        },
        { provide: WhatsAppConnectionRepository, useValue: { findByWorkspace: jest.fn() } },
        { provide: TokenEncryptionService, useValue: { decrypt: jest.fn() } },
        {
          provide: MetaApiClient,
          useValue: { createTemplate: jest.fn(), listTemplates: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(TemplateService);
    templateRepository = moduleRef.get(TemplateRepository);
    connectionRepository = moduleRef.get(WhatsAppConnectionRepository);
    tokenEncryption = moduleRef.get(TokenEncryptionService);
    metaApiClient = moduleRef.get(MetaApiClient);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("rejects a template with no BODY component", async () => {
      await expect(
        service.create("workspace-1", "user-1", {
          name: "welcome",
          category: TemplateCategory.UTILITY,
          language: "en_US",
          components: [{ type: "HEADER", format: "TEXT", text: "Welcome" }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(templateRepository.create).not.toHaveBeenCalled();
    });

    it("creates a DRAFT template with a valid BODY component", async () => {
      templateRepository.create.mockResolvedValue({
        _id: { toString: () => "template-1" },
        name: "welcome",
        category: TemplateCategory.UTILITY,
        language: "en_US",
        components: [{ type: "BODY", text: "Hi {{1}}" }],
        status: TemplateStatus.DRAFT,
        metaTemplateId: null,
        rejectionReason: null,
        createdAt: new Date("2026-08-05T00:00:00.000Z"),
      } as never);

      const result = await service.create("workspace-1", "user-1", {
        name: "welcome",
        category: TemplateCategory.UTILITY,
        language: "en_US",
        components: [{ type: "BODY", text: "Hi {{1}}" }],
      });

      expect(result.status).toBe(TemplateStatus.DRAFT);
      expect(templateRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "workspace-1", createdBy: "user-1" }),
      );
    });
  });

  describe("submit", () => {
    it("rejects submitting a template that isn't DRAFT", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        status: TemplateStatus.PENDING,
      } as never);

      await expect(service.submit("workspace-1", "template-1", "user-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("throws when the workspace has no WhatsApp connection", async () => {
      templateRepository.findByIdForWorkspace.mockResolvedValue({
        status: TemplateStatus.DRAFT,
      } as never);
      connectionRepository.findByWorkspace.mockResolvedValue(null);

      await expect(service.submit("workspace-1", "template-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("submits to Meta, moves the template to PENDING, and emits TEMPLATE_SUBMITTED", async () => {
      templateRepository.findByIdForWorkspace
        .mockResolvedValueOnce({
          status: TemplateStatus.DRAFT,
          name: "welcome",
          category: TemplateCategory.UTILITY,
          language: "en_US",
          components: [{ type: "BODY", text: "Hi {{1}}" }],
        } as never)
        .mockResolvedValueOnce({
          _id: { toString: () => "template-1" },
          status: TemplateStatus.PENDING,
          name: "welcome",
          category: TemplateCategory.UTILITY,
          language: "en_US",
          components: [{ type: "BODY", text: "Hi {{1}}" }],
          metaTemplateId: "meta-tpl-1",
          rejectionReason: null,
          createdAt: new Date("2026-08-05T00:00:00.000Z"),
        } as never);
      connectionRepository.findByWorkspace.mockResolvedValue({
        wabaId: "waba-1",
        accessTokenEncrypted: "encrypted",
      } as never);
      tokenEncryption.decrypt.mockReturnValue("raw-token");
      metaApiClient.createTemplate.mockResolvedValue({
        metaTemplateId: "meta-tpl-1",
        status: "PENDING",
      });
      templateRepository.markSubmitted.mockResolvedValue({} as never);

      const result = await service.submit("workspace-1", "template-1", "user-1");

      expect(metaApiClient.createTemplate).toHaveBeenCalledWith("waba-1", "raw-token", {
        name: "welcome",
        category: TemplateCategory.UTILITY,
        language: "en_US",
        components: [{ type: "BODY", text: "Hi {{1}}" }],
      });
      expect(templateRepository.markSubmitted).toHaveBeenCalledWith("template-1", "meta-tpl-1");
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.template_submitted",
        expect.objectContaining({ templateId: "template-1", metaTemplateId: "meta-tpl-1" }),
      );
      expect(result.status).toBe(TemplateStatus.PENDING);
    });
  });

  describe("syncFromMeta", () => {
    it("upserts templates and emits TEMPLATE_STATUS_CHANGED only when status actually changed", async () => {
      connectionRepository.findByWorkspace.mockResolvedValue({
        wabaId: "waba-1",
        accessTokenEncrypted: "encrypted",
      } as never);
      tokenEncryption.decrypt.mockReturnValue("raw-token");
      metaApiClient.listTemplates.mockResolvedValue([
        {
          metaTemplateId: "meta-tpl-1",
          name: "welcome",
          status: "APPROVED",
          category: "UTILITY",
          language: "en_US",
          components: [{ type: "BODY", text: "Hi {{1}}" }],
          rejectedReason: null,
        },
        {
          metaTemplateId: "meta-tpl-2",
          name: "order_update",
          status: "REJECTED",
          category: "UTILITY",
          language: "en_US",
          components: [{ type: "BODY", text: "Order update" }],
          rejectedReason: "Policy violation",
        },
      ]);

      // First template: previously PENDING locally -> now APPROVED (changed).
      // Second template: brand new (never synced before) -> no "previous" status to compare.
      templateRepository.findByMetaTemplateId
        .mockResolvedValueOnce({ status: TemplateStatus.PENDING } as never)
        .mockResolvedValueOnce(null);
      templateRepository.upsertFromMetaSync
        .mockResolvedValueOnce({
          _id: { toString: () => "template-1" },
          status: TemplateStatus.APPROVED,
          name: "welcome",
          category: TemplateCategory.UTILITY,
          language: "en_US",
          components: [{ type: "BODY", text: "Hi {{1}}" }],
          metaTemplateId: "meta-tpl-1",
          rejectionReason: null,
          createdAt: new Date("2026-08-05T00:00:00.000Z"),
        } as never)
        .mockResolvedValueOnce({
          _id: { toString: () => "template-2" },
          status: TemplateStatus.REJECTED,
          name: "order_update",
          category: TemplateCategory.UTILITY,
          language: "en_US",
          components: [{ type: "BODY", text: "Order update" }],
          metaTemplateId: "meta-tpl-2",
          rejectionReason: "Policy violation",
          createdAt: new Date("2026-08-05T00:00:00.000Z"),
        } as never);

      const results = await service.syncFromMeta("workspace-1");

      expect(results).toHaveLength(2);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "communication.template_status_changed",
        expect.objectContaining({
          templateId: "template-1",
          previousStatus: TemplateStatus.PENDING,
          newStatus: TemplateStatus.APPROVED,
        }),
      );
    });
  });
});
