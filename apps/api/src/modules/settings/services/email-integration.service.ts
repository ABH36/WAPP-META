import { Injectable, NotFoundException } from "@nestjs/common";
import { createTransport } from "nodemailer";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { EmailIntegrationRepository } from "../repositories/email-integration.repository.js";
import { EmailEncryption } from "../schemas/email-integration.schema.js";
import type { UpdateEmailIntegrationDto } from "../dto/update-email-integration.dto.js";
import type { EmailIntegrationSummary } from "../settings.types.js";

const EMPTY_SUMMARY: EmailIntegrationSummary = {
  configured: false,
  provider: null,
  host: null,
  port: null,
  username: null,
  encryption: null,
  fromAddress: null,
  status: null,
  lastTestedAt: null,
  lastError: null,
};

/**
 * PRD-006 Volume-3 §4.2 — configuration + real connection validation only
 * (BR-005). `credentialEncrypted` is decrypted only for the Test Connection
 * handshake, never returned through the API (BR-002). The existing global
 * Resend send pipeline is untouched — see
 * docs/ADR-SET-005-integration-ownership-strategy.md.
 */
@Injectable()
export class EmailIntegrationService {
  constructor(
    private readonly emailIntegrationRepository: EmailIntegrationRepository,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  async getSummary(workspaceId: string): Promise<EmailIntegrationSummary> {
    const config = await this.emailIntegrationRepository.findByWorkspace(workspaceId);
    if (!config) {
      return EMPTY_SUMMARY;
    }
    return {
      configured: true,
      provider: config.provider,
      host: config.host,
      port: config.port,
      username: config.username,
      encryption: config.encryption,
      fromAddress: config.fromAddress,
      status: config.status,
      lastTestedAt: config.lastTestedAt ? config.lastTestedAt.toISOString() : null,
      lastError: config.lastError,
    };
  }

  async updateConfig(
    workspaceId: string,
    dto: UpdateEmailIntegrationDto,
  ): Promise<EmailIntegrationSummary> {
    await this.emailIntegrationRepository.upsert({
      workspaceId,
      provider: dto.provider,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      credentialEncrypted: this.tokenEncryption.encrypt(dto.credential),
      encryption: dto.encryption,
      fromAddress: dto.fromAddress,
    });
    return this.getSummary(workspaceId);
  }

  /** BR-005 — validation only; no email is ever actually sent from this path. */
  async testConnection(workspaceId: string): Promise<{ success: boolean; error: string | null }> {
    const config = await this.emailIntegrationRepository.findByWorkspaceWithCredential(workspaceId);
    if (!config) {
      throw new NotFoundException("No email integration configured for this workspace");
    }

    const credential = this.tokenEncryption.decrypt(config.credentialEncrypted);
    const transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.encryption === EmailEncryption.SSL,
      requireTLS: config.encryption === EmailEncryption.TLS,
      auth: { user: config.username, pass: credential },
    });

    try {
      await transporter.verify();
      await this.emailIntegrationRepository.recordTestResult(workspaceId, true, null);
      return { success: true, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown SMTP error";
      await this.emailIntegrationRepository.recordTestResult(workspaceId, false, message);
      return { success: false, error: message };
    }
  }
}
