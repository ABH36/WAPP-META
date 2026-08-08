import { Body, Controller, Get, Param, ParseEnumPipe, Patch, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import {
  PlatformFeatureFlagsService,
  type PlatformFeatureFlagSummary,
} from "../services/platform-feature-flags.service.js";
import { TogglePlatformFeatureFlagDto } from "../dto/toggle-platform-feature-flag.dto.js";
import { FeatureFlagKey } from "../../settings/schemas/feature-flag-state.schema.js";
import type { AuthenticatedPlatformUser } from "../platform.types.js";

/** §4.5/§9 — GET/PATCH /platform/feature-flags. */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/feature-flags", version: "1" })
export class PlatformFeatureFlagsController {
  constructor(private readonly platformFeatureFlagsService: PlatformFeatureFlagsService) {}

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS)
  @Get()
  async list(): Promise<PlatformFeatureFlagSummary[]> {
    return this.platformFeatureFlagsService.list();
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_FEATURE_FLAGS)
  @Patch(":flagKey")
  async setEnabled(
    @Param("flagKey", new ParseEnumPipe(FeatureFlagKey)) flagKey: FeatureFlagKey,
    @Body() dto: TogglePlatformFeatureFlagDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<PlatformFeatureFlagSummary> {
    return this.platformFeatureFlagsService.setEnabled(flagKey, dto.enabled, user.platformUserId);
  }
}
