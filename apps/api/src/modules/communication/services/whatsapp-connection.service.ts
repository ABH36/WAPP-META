import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { WhatsAppConnectedPayload } from "../../../common/events/domain-events.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { MetaApiClient } from "./meta-api-client.service.js";
import { WhatsAppConnectionRepository } from "../repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { toConnectionSummary, toPhoneNumberSummary } from "../mappers/communication.mapper.js";
import type { ConnectionSummary, PhoneNumberSummary } from "../communication.types.js";
import type { ConnectWhatsAppDto } from "../dto/connect-whatsapp.dto.js";

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
}
