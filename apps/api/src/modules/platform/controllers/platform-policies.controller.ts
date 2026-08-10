import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { PlatformPermission } from "@wapp/shared-types";
import { Public } from "../../../common/decorators/public.decorator.js";
import { PlatformAuthGuard } from "../guards/platform-auth.guard.js";
import { PlatformPermissionsGuard } from "../guards/platform-permissions.guard.js";
import { RequirePlatformPermission } from "../decorators/require-platform-permission.decorator.js";
import { CurrentPlatformUser } from "../decorators/current-platform-user.decorator.js";
import { PlatformGovernancePolicyService } from "../services/platform-governance-policy.service.js";
import { UpdateGovernancePolicyDto } from "../dto/update-governance-policy.dto.js";
import type { AuthenticatedPlatformUser, GovernancePolicySummary } from "../platform.types.js";

/** §4.3/§4.6 (merged) §9 — GET/PATCH /platform/policies, both gated MANAGE_PLATFORM_POLICIES (Super-Admin-only, per §6/§Security). */
@Public()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller({ path: "platform/policies", version: "1" })
export class PlatformPoliciesController {
  constructor(private readonly platformGovernancePolicyService: PlatformGovernancePolicyService) {}

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_POLICIES)
  @Get()
  async list(): Promise<GovernancePolicySummary[]> {
    return this.platformGovernancePolicyService.list();
  }

  @RequirePlatformPermission(PlatformPermission.MANAGE_PLATFORM_POLICIES)
  @Patch(":key")
  async update(
    @Param("key") key: string,
    @Body() dto: UpdateGovernancePolicyDto,
    @CurrentPlatformUser() user: AuthenticatedPlatformUser,
  ): Promise<GovernancePolicySummary> {
    return this.platformGovernancePolicyService.update(key, dto, user.platformUserId);
  }
}
