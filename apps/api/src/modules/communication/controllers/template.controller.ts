import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { TemplateService } from "../services/template.service.js";
import { CreateTemplateDto } from "../dto/create-template.dto.js";
import type { TemplateSummary } from "../communication.types.js";

@Controller({ path: "communication/templates", version: "1" })
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @RequirePermission(Permission.VIEW_TEMPLATES)
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<TemplateSummary[]> {
    return this.templateService.list(user.workspaceId!);
  }

  @RequirePermission(Permission.VIEW_TEMPLATES)
  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<TemplateSummary> {
    return this.templateService.getById(user.workspaceId!, id);
  }

  @RequirePermission(Permission.CREATE_TEMPLATES)
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTemplateDto,
  ): Promise<TemplateSummary> {
    return this.templateService.create(user.workspaceId!, user.userId, dto);
  }

  @RequirePermission(Permission.MANAGE_TEMPLATES)
  @Post(":id/submit")
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<TemplateSummary> {
    return this.templateService.submit(user.workspaceId!, id, user.userId);
  }

  @RequirePermission(Permission.MANAGE_TEMPLATES)
  @Post("sync")
  async sync(@CurrentUser() user: AuthenticatedUser): Promise<TemplateSummary[]> {
    return this.templateService.syncFromMeta(user.workspaceId!);
  }
}
