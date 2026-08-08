import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PlatformRole } from "@wapp/shared-types";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformPasswordService } from "./platform-password.service.js";
import { toPlatformUserProfile } from "./platform-auth.service.js";
import type { PlatformUserProfile } from "../platform.types.js";

/** PRD-007 Volume-1 §4.3 — Platform Users are provisioned by a PLATFORM_SUPER_ADMIN only (gated at the controller via @RequirePlatformPermission(MANAGE_PLATFORM_USERS)), never self-registered. */
@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly platformUserRepository: PlatformUserRepository,
    private readonly passwordService: PlatformPasswordService,
  ) {}

  async create(
    fullName: string,
    email: string,
    password: string,
    role: PlatformRole,
  ): Promise<PlatformUserProfile> {
    const existing = await this.platformUserRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException("A platform account with this email already exists");
    }

    const passwordHash = await this.passwordService.hash(password);
    const created = await this.platformUserRepository.create({
      fullName,
      email,
      passwordHash,
      role,
    });
    return toPlatformUserProfile(created);
  }

  async list(): Promise<PlatformUserProfile[]> {
    const users = await this.platformUserRepository.findAll();
    return users.map(toPlatformUserProfile);
  }

  async setActive(id: string, isActive: boolean): Promise<PlatformUserProfile> {
    const updated = await this.platformUserRepository.setActive(id, isActive);
    if (!updated) {
      throw new NotFoundException("Platform user not found");
    }
    return toPlatformUserProfile(updated);
  }
}
