import { Test } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PlatformRole } from "@wapp/shared-types";
import { PlatformUsersService } from "./platform-users.service.js";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformPasswordService } from "./platform-password.service.js";
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

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformUsersService,
        {
          provide: PlatformUserRepository,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            setActive: jest.fn(),
          },
        },
        { provide: PlatformPasswordService, useValue: { hash: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(PlatformUsersService);
    platformUserRepository = moduleRef.get(PlatformUserRepository);
    passwordService = moduleRef.get(PlatformPasswordService);
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
});
