import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { SettingsApiKeysService } from "../services/settings-api-keys.service.js";
import { CreateApiKeyDto } from "../dto/create-api-key.dto.js";
import type { ApiKeySummary } from "../../identity/identity.types.js";
import type { GeneratedApiKey } from "../../identity/services/api-key.service.js";

/** PRD-006 Volume-3 §4.4/§9. Reuses EDIT_WORKSPACE — §7 notes Developer API Keys "may become a future dedicated permission," not this volume. */
@Controller({ path: "settings/api-keys", version: "1" })
export class ApiKeysController {
  constructor(private readonly apiKeysService: SettingsApiKeysService) {}

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ApiKeySummary[]> {
    return this.apiKeysService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ): Promise<GeneratedApiKey> {
    return this.apiKeysService.create(user.workspaceId!, user.userId, dto);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Delete(":id")
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ApiKeySummary> {
    return this.apiKeysService.revoke(user.workspaceId!, user.userId, id);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post(":id/rotate")
  async rotate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<GeneratedApiKey> {
    return this.apiKeysService.rotate(user.workspaceId!, user.userId, id);
  }
}
