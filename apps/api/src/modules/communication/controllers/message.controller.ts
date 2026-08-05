import { Controller, Get, Param, Post, Query, Body } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { MessageService } from "../services/message.service.js";
import { SendMessageDto } from "../dto/send-message.dto.js";
import { SendTemplateMessageDto } from "../dto/send-template-message.dto.js";
import type { MessageSummary } from "../communication.types.js";

@Controller({ path: "communication", version: "1" })
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Post("phone-numbers/:phoneNumberId/messages")
  async send(
    @CurrentUser() user: AuthenticatedUser,
    @Param("phoneNumberId") phoneNumberId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageSummary> {
    return this.messageService.sendText(user.workspaceId!, phoneNumberId, user.userId, dto);
  }

  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Post("phone-numbers/:phoneNumberId/template-messages")
  async sendTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("phoneNumberId") phoneNumberId: string,
    @Body() dto: SendTemplateMessageDto,
  ): Promise<MessageSummary> {
    return this.messageService.sendTemplate(user.workspaceId!, phoneNumberId, user.userId, dto);
  }

  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Get("contacts/:contactId/messages")
  async listForContact(
    @CurrentUser() user: AuthenticatedUser,
    @Param("contactId") contactId: string,
    @Query("limit") limit?: string,
  ): Promise<MessageSummary[]> {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.messageService.listForContact(
      user.workspaceId!,
      contactId,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }
}
