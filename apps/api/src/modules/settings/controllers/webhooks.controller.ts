import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { WebhookService } from "../services/webhook.service.js";
import { CreateWebhookDto } from "../dto/create-webhook.dto.js";
import { UpdateWebhookDto } from "../dto/update-webhook.dto.js";
import type { WebhookSummary } from "../settings.types.js";

/** PRD-006 Volume-3 §4.3/§9. Reuses EDIT_WORKSPACE — no dedicated webhook permission was proposed or is needed. */
@Controller({ path: "settings/webhooks", version: "1" })
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<WebhookSummary[]> {
    return this.webhookService.list(user.workspaceId!);
  }

  // BR-002/BR-007-pattern — the secret is returned exactly once, here, and never again.
  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebhookDto,
  ): Promise<{ webhook: WebhookSummary; secret: string }> {
    return this.webhookService.create(user.workspaceId!, user.userId, dto);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Patch(":id")
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateWebhookDto,
  ): Promise<WebhookSummary> {
    return this.webhookService.update(user.workspaceId!, user.userId, id, dto);
  }

  @RequirePermission(Permission.EDIT_WORKSPACE)
  @Delete(":id")
  async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.webhookService.delete(user.workspaceId!, id);
  }
}
