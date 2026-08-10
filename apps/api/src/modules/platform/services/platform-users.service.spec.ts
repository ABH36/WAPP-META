import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PlatformRole } from "@wapp/shared-types";
import { PlatformUsersService } from "./platform-users.service.js";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformPasswordService } from "./platform-password.service.js";
import { DomainEvent } from "../../../common/events/domain-events.js";
import type { PlatformUserDocument } from "../schemas/platform-user.schema.js";

function fakePlatformUser(overrides: Partial<Record<string, unknown>> = {}): PlatformUserDocument {
  const base = {
    _id: { toString: () => "platform-user-1" },
    fullName: "Priya Admin",
    email: "priya@wapp.internal",
    role: PlatformRole.PLATFORM_SUPPORT_MANAGER,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
  return base as unknown as PlatformUserDocument;
}

describe("PlatformUsersService", () => {
  let service: PlatformUsersService;
  let platformUserRepository: jest.Mocked<PlatformUserRepository>;
  let passwordService: jest.Mocked<PlatformPasswordService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformUsersService,
        {
          provide: PlatformUserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            setActive: jest.fn(),
            updateRole: jest.fn(),
          },
        },
        { provide: PlatformPasswordService, useValue: { hash: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformUsersService);
    platformUserRepository = moduleRef.get(PlatformUserRepository);
    passwordService = moduleRef.get(PlatformPasswordService);
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  describe("create", () => {
    it("hashes the password and provisions a new platform user", async () => {
      platformUserRepository.findByEmail.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue("hashed-password");
      platformUserRepository.create.mockResolvedValue(fakePlatformUser());

      const result = await service.create(
        "Priya Admin",
        "priya@wapp.internal",
        "Passw0rd1",
        PlatformRole.PLATFORM_SUPPORT_MANAGER,
      );

      expect(passwordService.hash).toHaveBeenCalledWith("Passw0rd1");
      expect(platformUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "priya@wapp.internal", passwordHash: "hashed-password" }),
      );
      expect(result.email).toBe("priya@wapp.internal");
    });

    it("rejects a duplicate email", async () => {
      platformUserRepository.findByEmail.mockResolvedValue(fakePlatformUser());

      await expect(
        service.create(
          "Priya Admin",
          "priya@wapp.internal",
          "Passw0rd1",
          PlatformRole.PLATFORM_SUPPORT_MANAGER,
        ),
      ).rejects.toThrow(ConflictException);
      expect(platformUserRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("maps every platform user to a profile", async () => {
      platformUserRepository.findAll.mockResolvedValue([fakePlatformUser()]);

      const result = await service.list();

      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe("priya@wapp.internal");
    });
  });

  describe("setActive", () => {
    it("updates and returns the profile", async () => {
      platformUserRepository.setActive.mockResolvedValue(fakePlatformUser({ isActive: false }));

      const result = await service.setActive("platform-user-1", false);

      expect(platformUserRepository.setActive).toHaveBeenCalledWith("platform-user-1", false);
      expect(result.isActive).toBe(false);
    });

    it("throws NotFoundException when the platform user doesn't exist", async () => {
      platformUserRepository.setActive.mockResolvedValue(null);

      await expect(service.setActive("missing", false)).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateRole", () => {
    it("updates the role and emits PLATFORM_USER_ROLE_CHANGED with the previous and new role", async () => {
      platformUserRepository.findById.mockResolvedValue(
        fakePlatformUser({ role: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE }),
      );
      platformUserRepository.updateRole.mockResolvedValue(
        fakePlatformUser({ role: PlatformRole.PLATFORM_SUPPORT_MANAGER }),
      );

      const result = await service.updateRole(
        "platform-user-1",
        PlatformRole.PLATFORM_SUPPORT_MANAGER,
        "super-1",
      );

      expect(platformUserRepository.updateRole).toHaveBeenCalledWith(
        "platform-user-1",
        PlatformRole.PLATFORM_SUPPORT_MANAGER,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DomainEvent.PLATFORM_USER_ROLE_CHANGED,
        expect.objectContaining({
          platformUserId: "platform-user-1",
          previousRole: PlatformRole.PLATFORM_SUPPORT_EXECUTIVE,
          newRole: PlatformRole.PLATFORM_SUPPORT_MANAGER,
          actorId: "super-1",
        }),
      );
      expect(result.role).toBe(PlatformRole.PLATFORM_SUPPORT_MANAGER);
    });

    it("throws NotFoundException when the platform user doesn't exist", async () => {
      platformUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateRole("missing", PlatformRole.PLATFORM_SUPPORT_MANAGER, "super-1"),
      ).rejects.toThrow(NotFoundException);
      expect(platformUserRepository.updateRole).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
