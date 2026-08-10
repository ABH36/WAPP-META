import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { PlatformRole } from "@wapp/shared-types";
import { PlatformUserRepository } from "../repositories/platform-user.repository.js";
import { PlatformPasswordService } from "./platform-password.service.js";
import { toPlatformUserProfile } from "./platform-auth.service.js";
import {
  DomainEvent,
  type PlatformUserRoleChangedPayload,
} from "../../../common/events/domain-events.js";
import type { PlatformUserProfile } from "../platform.types.js";

/** PRD-007 Volume-1 §4.3 — Platform Users are provisioned by a PLATFORM_SUPER_ADMIN only (gated at the controller via @RequirePlatformPermission(MANAGE_PLATFORM_USERS)), never self-registered. */
@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly platformUserRepository: PlatformUserRepository,
    private readonly passwordService: PlatformPasswordService,
    private readonly eventEmitter: EventEmitter2,
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

  /** PRD-007 Volume-4 §4.4 ("Platform Permission Changes") — Architecture Review, 2026-08-10: "A minimal PlatformUser role-change operation is authorized. Every successful role change shall emit PLATFORM_USER_ROLE_CHANGED and generate Platform Audit entries." */
  async updateRole(
    id: string,
    newRole: PlatformRole,
    actorId: string,
  ): Promise<PlatformUserProfile> {
    const existing = await this.platformUserRepository.findById(id);
    if (!existing) {
      throw new NotFoundException("Platform user not found");
    }
    const previousRole = existing.role;

    const updated = await this.platformUserRepository.updateRole(id, newRole);
    if (!updated) {
      throw new NotFoundException("Platform user not found");
    }

    const payload: PlatformUserRoleChangedPayload = {
      platformUserId: id,
      previousRole,
      newRole,
      actorId,
      occurredAt: new Date().toISOString(),
    };
    this.eventEmitter.emit(DomainEvent.PLATFORM_USER_ROLE_CHANGED, payload);

    return toPlatformUserProfile(updated);
  }
}
