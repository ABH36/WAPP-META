import { Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { WhatsAppConnectedPayload } from "../../../common/events/domain-events.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { MetaApiClient } from "./meta-api-client.service.js";
import { WhatsAppConnectionRepository } from "../repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { toConnectionSummary, toPhoneNumberSummary } from "../mappers/communication.mapper.js";
import type { ConnectionSummary, PhoneNumberSummary } from "../communication.types.js";
import { WhatsAppConnectionStatus } from "../schemas/whatsapp-connection.schema.js";
import type { ConnectWhatsAppDto } from "../dto/connect-whatsapp.dto.js";

export interface TestConnectionResult {
  status: WhatsAppConnectionStatus;
  verifiedName: string | null;
  error: string | null;
}

/**
 * Orchestrates the Embedded Signup connect flow (PRD-003 Part 1, WA-BR-003 —
 * Owner/Admin only, enforced at the controller via RequirePermission).
 * Nothing is written to the database until every Meta API call in the flow
 * succeeds — a partial failure leaves no partial connection record behind,
 * the caller just gets an error and can retry.
 */
@Injectable()
export class WhatsAppConnectionService {
  constructor(
    private readonly connectionRepository: WhatsAppConnectionRepository,
    private readonly phoneNumberRepository: PhoneNumberRepository,
    private readonly metaApiClient: MetaApiClient,
    private readonly tokenEncryption: TokenEncryptionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async connect(
    workspaceId: string,
    connectedBy: string,
    dto: ConnectWhatsAppDto,
  ): Promise<{ connection: ConnectionSummary; phoneNumber: PhoneNumberSummary }> {
    const accessToken = await this.metaApiClient.exchangeCodeForToken(dto.code);
    await this.metaApiClient.subscribeToWebhooks(dto.wabaId, accessToken);
    const businessName = await this.metaApiClient.getWabaName(dto.wabaId, accessToken);
    const phoneDetails = await this.metaApiClient.getPhoneNumberDetails(
      dto.phoneNumberId,
      accessToken,
    );

    const connection = await this.connectionRepository.upsertForWorkspace({
      workspaceId,
      wabaId: dto.wabaId,
      businessName,
      accessTokenEncrypted: this.tokenEncryption.encrypt(accessToken),
      connectedBy,
    });

    const phoneNumber = await this.phoneNumberRepository.upsert(
      workspaceId,
      connection._id.toString(),
      dto.phoneNumberId,
      phoneDetails,
    );

    this.eventEmitter.emit(DomainEvent.WHATSAPP_CONNECTED, {
      workspaceId,
      wabaId: dto.wabaId,
      connectedBy,
      occurredAt: new Date().toISOString(),
    } satisfies WhatsAppConnectedPayload);

    return {
      connection: toConnectionSummary(connection),
      phoneNumber: toPhoneNumberSummary(phoneNumber),
    };
  }

  async getConnection(workspaceId: string): Promise<ConnectionSummary | null> {
    const connection = await this.connectionRepository.findByWorkspace(workspaceId);
    return connection ? toConnectionSummary(connection) : null;
  }

  async listPhoneNumbers(workspaceId: string): Promise<PhoneNumberSummary[]> {
    const phoneNumbers = await this.phoneNumberRepository.findByWorkspace(workspaceId);
    return phoneNumbers.map(toPhoneNumberSummary);
  }

  /**
   * PRD-006 Volume-3 §4.1 "Test Connection" — BR-005: validation only, no
   * business operation is performed. Never throws on a Meta failure; the
   * ERROR status/message *is* the answer the caller is asking for.
   */
  async testConnection(workspaceId: string): Promise<TestConnectionResult> {
    const connection = await this.connectionRepository.findByWorkspace(workspaceId);
    if (!connection) {
      throw new NotFoundException("No WhatsApp connection exists for this workspace");
    }

    const accessToken = this.tokenEncryption.decrypt(connection.accessTokenEncrypted);
    try {
      const businessName = await this.metaApiClient.getWabaName(connection.wabaId, accessToken);
      await this.connectionRepository.recordSuccess(workspaceId, businessName);
      return {
        status: WhatsAppConnectionStatus.CONNECTED,
        verifiedName: businessName,
        error: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Meta API error";
      await this.connectionRepository.recordError(workspaceId, message);
      return { status: WhatsAppConnectionStatus.ERROR, verifiedName: null, error: message };
    }
  }

  /**
   * PRD-006 Volume-3 §4.1 "Disconnect" — BR-004: never deletes business data.
   * Phone numbers, conversations, and messages already synced stay exactly
   * as they are; only the connection's own status flips.
   */
  async disconnect(workspaceId: string): Promise<ConnectionSummary> {
    const connection = await this.connectionRepository.findByWorkspace(workspaceId);
    if (!connection) {
      throw new NotFoundException("No WhatsApp connection exists for this workspace");
    }

    await this.connectionRepository.setStatus(workspaceId, WhatsAppConnectionStatus.DISCONNECTED);
    const updated = await this.connectionRepository.findByWorkspace(workspaceId);
    return toConnectionSummary(updated!);
  }

  /**
   * PRD-006 Volume-3 §4.1 "Refresh Metadata" — re-pulls the WABA name and
   * every synced phone number's details from Meta. A failure marks the
   * connection ERROR (same as testConnection) and rethrows, since (unlike
   * Test Connection) the caller asked for fresh data, not just a health
   * check, and would otherwise wrongly think refresh succeeded.
   */
  async refreshMetadata(
    workspaceId: string,
  ): Promise<{ connection: ConnectionSummary; phoneNumbers: PhoneNumberSummary[] }> {
    const connection = await this.connectionRepository.findByWorkspace(workspaceId);
    if (!connection) {
      throw new NotFoundException("No WhatsApp connection exists for this workspace");
    }

    const accessToken = this.tokenEncryption.decrypt(connection.accessTokenEncrypted);

    try {
      const businessName = await this.metaApiClient.getWabaName(connection.wabaId, accessToken);
      await this.connectionRepository.recordSuccess(workspaceId, businessName);

      const phoneNumbers = await this.phoneNumberRepository.findByWorkspace(workspaceId);
      const refreshed: PhoneNumberSummary[] = [];
      for (const phoneNumber of phoneNumbers) {
        const details = await this.metaApiClient.getPhoneNumberDetails(
          phoneNumber.phoneNumberId,
          accessToken,
        );
        const updatedPhoneNumber = await this.phoneNumberRepository.upsert(
          workspaceId,
          connection._id.toString(),
          phoneNumber.phoneNumberId,
          details,
        );
        refreshed.push(toPhoneNumberSummary(updatedPhoneNumber));
      }

      const updatedConnection = await this.connectionRepository.findByWorkspace(workspaceId);
      return { connection: toConnectionSummary(updatedConnection!), phoneNumbers: refreshed };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Meta API error";
      await this.connectionRepository.recordError(workspaceId, message);
      throw error;
    }
  }
}
