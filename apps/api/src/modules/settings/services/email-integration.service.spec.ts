import { Test } from "@nestjs/testing";
import { createTransport } from "nodemailer";
import { EmailIntegrationService } from "./email-integration.service.js";
import { EmailIntegrationRepository } from "../repositories/email-integration.repository.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { EmailEncryption, EmailProvider } from "../schemas/email-integration.schema.js";
import { IntegrationConnectionStatus } from "../schemas/integration-status.enum.js";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

function fakeConfig(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "workspace-1",
    provider: EmailProvider.SMTP,
    host: "smtp.example.com",
    port: 587,
    username: "notifications@example.com",
    credentialEncrypted: "encrypted-credential",
    encryption: EmailEncryption.TLS,
    fromAddress: "notifications@example.com",
    status: IntegrationConnectionStatus.DISCONNECTED,
    lastTestedAt: null,
    lastError: null,
    ...overrides,
  };
}

describe("EmailIntegrationService", () => {
  let service: EmailIntegrationService;
  let emailIntegrationRepository: jest.Mocked<EmailIntegrationRepository>;
  let tokenEncryption: jest.Mocked<TokenEncryptionService>;
  const mockCreateTransport = createTransport as jest.Mock;

  beforeEach(async () => {
    mockCreateTransport.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailIntegrationService,
        {
          provide: EmailIntegrationRepository,
          useValue: {
            findByWorkspace: jest.fn(),
            findByWorkspaceWithCredential: jest.fn(),
            upsert: jest.fn(),
            recordTestResult: jest.fn(),
          },
        },
        { provide: TokenEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(EmailIntegrationService);
    emailIntegrationRepository = moduleRef.get(EmailIntegrationRepository);
    tokenEncryption = moduleRef.get(TokenEncryptionService);
  });

  describe("getSummary", () => {
    it("returns an unconfigured summary when nothing has been saved yet", async () => {
      emailIntegrationRepository.findByWorkspace.mockResolvedValue(null);
      const result = await service.getSummary("workspace-1");
      expect(result.configured).toBe(false);
      expect(result.provider).toBeNull();
    });
  });

  describe("updateConfig", () => {
    it("encrypts the credential before persisting — never stores it in plaintext", async () => {
      tokenEncryption.encrypt.mockReturnValue("encrypted-credential");
      emailIntegrationRepository.findByWorkspace.mockResolvedValue(fakeConfig() as never);

      await service.updateConfig("workspace-1", {
        provider: EmailProvider.SMTP,
        host: "smtp.example.com",
        port: 587,
        username: "notifications@example.com",
        credential: "super-secret-password",
        encryption: EmailEncryption.TLS,
        fromAddress: "notifications@example.com",
      });

      expect(tokenEncryption.encrypt).toHaveBeenCalledWith("super-secret-password");
      expect(emailIntegrationRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ credentialEncrypted: "encrypted-credential" }),
      );
    });
  });

  describe("testConnection", () => {
    it("throws NotFoundException when no config exists", async () => {
      emailIntegrationRepository.findByWorkspaceWithCredential.mockResolvedValue(null);
      await expect(service.testConnection("workspace-1")).rejects.toThrow(
        "No email integration configured",
      );
    });

    it("BR-005 — records CONNECTED on a successful SMTP handshake, never sends anything", async () => {
      emailIntegrationRepository.findByWorkspaceWithCredential.mockResolvedValue(
        fakeConfig() as never,
      );
      tokenEncryption.decrypt.mockReturnValue("plaintext-credential");
      const verify = jest.fn().mockResolvedValue(true);
      mockCreateTransport.mockReturnValue({ verify });

      const result = await service.testConnection("workspace-1");

      expect(verify).toHaveBeenCalled();
      expect(emailIntegrationRepository.recordTestResult).toHaveBeenCalledWith(
        "workspace-1",
        true,
        null,
      );
      expect(result).toEqual({ success: true, error: null });
    });

    it("records ERROR and returns the failure without throwing when the handshake fails", async () => {
      emailIntegrationRepository.findByWorkspaceWithCredential.mockResolvedValue(
        fakeConfig() as never,
      );
      tokenEncryption.decrypt.mockReturnValue("plaintext-credential");
      const verify = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      mockCreateTransport.mockReturnValue({ verify });

      const result = await service.testConnection("workspace-1");

      expect(emailIntegrationRepository.recordTestResult).toHaveBeenCalledWith(
        "workspace-1",
        false,
        "ECONNREFUSED",
      );
      expect(result).toEqual({ success: false, error: "ECONNREFUSED" });
    });
  });
});
