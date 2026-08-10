import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformUsersService } from "../services/platform-users.service.js";
import { CreatePlatformUserDto } from "../dto/create-platform-user.dto.js";
import { SetPlatformUserActiveDto } from "../dto/set-platform-user-active.dto.js";
import { UpdatePlatformUserRoleDto } from "../dto/update-platform-user-role.dto.js";
import type { AuthenticatedPlatformUser, PlatformUserProfile } from "../platform.types.js";

/** §4.3 — provisioning/listing/enable-disable of Platform Users, gated to PLATFORM_SUPER_ADMIN via MANAGE_PLATFORM_USERS. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/users", version: "1" })
export class PlatformUsersController {
  constructor(private readonly platformUsersService: PlatformUsersService) {}

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_USERS)
  @Post()
  async create(@Body() dto: CreatePlatformUserDto): Promise<PlatformUserProfile> {
    return this.platformUsersService.create(dto.fullName, dto.email, dto.password, dto.role);
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_USERS)
  @Get()
  async list(): Promise<PlatformUserProfile[]> {
    return this.platformUsersService.list();
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_USERS)
  @Patch(":id/active")
  async setActive(
    @Param("id") id: string,
    @Body() dto: SetPlatformUserActiveDto,
  ): Promise<PlatformUserProfile> {
    return this.platformUsersService.setActive(id, dto.isActive);
  }

  /** PRD-007 Volume-4 §4.4 — Architecture Review, 2026-08-10: minimal role-change capability, gated the same as every other Platform User mutation. */
  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_USERS)
  @Patch(":id/role")
  async updateRole(
    @Param("id") id: string,
    @Body() dto: UpdatePlatformUserRoleDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<PlatformUserProfile> {
    return this.platformUsersService.updateRole(id, dto.role, user.platformUserId);
  }
}
