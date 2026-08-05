import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WhatsAppConnectionService } from "./whatsapp-connection.service.js";
import { WhatsAppConnectionRepository } from "../repositories/whatsapp-connection.repository.js";
import { PhoneNumberRepository } from "../repositories/phone-number.repository.js";
import { MetaApiClient } from "./meta-api-client.service.js";
import { TokenEncryptionService } from "../../../common/security/token-encryption.service.js";
import { WhatsAppConnectionStatus } from "../schemas/whatsapp-connection.schema.js";
import { QualityRating } from "../schemas/phone-number.schema.js";

describe("WhatsAppConnectionService", () => {
  let service: WhatsAppConnectionService;
  let connectionRepository: jest.Mocked<WhatsAppConnectionRepository>;
  let phoneNumberRepository: jest.Mocked<PhoneNumberRepository>;
  let metaApiClient: jest.Mocked<MetaApiClient>;
  let tokenEncryption: jest.Mocked<TokenEncryptionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        WhatsAppConnectionService,
        {
          provide: WhatsAppConnectionRepository,
          useValue: { upsertForWorkspace: jest.fn(), findByWorkspace: jest.fn() },
        },
        {
          provide: PhoneNumberRepository,
          useValue: { upsert: jest.fn(), findByWorkspace: jest.fn() },
        },
        {
          provide: MetaApiClient,
          useValue: {
            exchangeCodeForToken: jest.fn(),
            subscribeToWebhooks: jest.fn(),
            getWabaName: jest.fn(),
            getPhoneNumberDetails: jest.fn(),
          },
        },
        { provide: TokenEncryptionService, useValue: { encrypt: jest.fn(), decrypt: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(WhatsAppConnectionService);
    connectionRepository = moduleRef.get(WhatsAppConnectionRepository);
    phoneNumberRepository = moduleRef.get(PhoneNumberRepository);
    metaApiClient = moduleRef.get(MetaApiClient);
    tokenEncryption = moduleRef.get(TokenEncryptionService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  it("runs the full connect flow and persists the connection + phone number", async () => {
    metaApiClient.exchangeCodeForToken.mockResolvedValue("raw-access-token");
    metaApiClient.getWabaName.mockResolvedValue("Acme Trading Co");
    metaApiClient.getPhoneNumberDetails.mockResolvedValue({
      displayPhoneNumber: "+91 98765 43210",
      verifiedName: "Acme Trading Co",
      qualityRating: "GREEN",
      messagingLimitTier: "TIER_1K",
    });
    tokenEncryption.encrypt.mockReturnValue("encrypted-token");
    connectionRepository.upsertForWorkspace.mockResolvedValue({
      _id: { toString: () => "connection-1" },
      wabaId: "waba-1",
      businessName: "Acme Trading Co",
      status: WhatsAppConnectionStatus.CONNECTED,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    } as never);
    phoneNumberRepository.upsert.mockResolvedValue({
      _id: { toString: () => "phone-1" },
      phoneNumberId: "meta-phone-1",
      displayPhoneNumber: "+91 98765 43210",
      verifiedName: "Acme Trading Co",
      qualityRating: QualityRating.GREEN,
      messagingLimitTier: "TIER_1K",
    } as never);

    const result = await service.connect("workspace-1", "user-1", {
      code: "auth-code",
      wabaId: "waba-1",
      phoneNumberId: "meta-phone-1",
    });

    expect(metaApiClient.subscribeToWebhooks).toHaveBeenCalledWith("waba-1", "raw-access-token");
    expect(connectionRepository.upsertForWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        wabaId: "waba-1",
        accessTokenEncrypted: "encrypted-token",
        connectedBy: "user-1",
      }),
    );
    expect(result.connection.wabaId).toBe("waba-1");
    expect(result.phoneNumber.phoneNumberId).toBe("meta-phone-1");
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      "communication.whatsapp_connected",
      expect.objectContaining({ workspaceId: "workspace-1", wabaId: "waba-1" }),
    );
  });

  it("does not persist anything if the Meta token exchange fails", async () => {
    metaApiClient.exchangeCodeForToken.mockRejectedValue(new Error("invalid code"));

    await expect(
      service.connect("workspace-1", "user-1", {
        code: "bad-code",
        wabaId: "waba-1",
        phoneNumberId: "meta-phone-1",
      }),
    ).rejects.toThrow("invalid code");
    expect(connectionRepository.upsertForWorkspace).not.toHaveBeenCalled();
  });

  it("returns null when the workspace has no connection", async () => {
    connectionRepository.findByWorkspace.mockResolvedValue(null);
    await expect(service.getConnection("workspace-1")).resolves.toBeNull();
  });
});
