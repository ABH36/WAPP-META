import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Permission } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import type { AuthenticatedUser } from "../../identity/identity.types.js";
import { ConversationService } from "../services/conversation.service.js";
import { ReplyConversationDto } from "../dto/reply-conversation.dto.js";
import { AssignConversationDto } from "../dto/assign-conversation.dto.js";
import { UpdateConversationStatusDto } from "../dto/update-conversation-status.dto.js";
import { CreateConversationNoteDto } from "../dto/create-conversation-note.dto.js";
import { ConversationStatus } from "../schemas/conversation.schema.js";
import type {
  ConversationNoteSummary,
  ConversationSummary,
  MessageSummary,
} from "../communication.types.js";
import type { Paginated } from "../../../common/interceptors/response.interceptor.js";

@Controller({ path: "communication/conversations", version: "1" })
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  // REPLY_CONVERSATIONS is used as the base "has Shared Inbox access at all"
  // gate for every read/reply route below — there is no separate
  // VIEW_CONVERSATIONS permission in PERMISSION_MATRIX (Marketing Executive,
  // the one role with no Conversations access, is already NONE here).
  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("status") status?: ConversationStatus,
    @Query("assignedToUserId") assignedToUserId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<Paginated<ConversationSummary>> {
    return this.conversationService.list(user.workspaceId!, {
      status,
      assignedToUserId,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Get(":id")
  async getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ConversationSummary> {
    return this.conversationService.getById(user.workspaceId!, id);
  }

  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Get(":id/messages")
  async listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Query("limit") limit?: string,
  ): Promise<MessageSummary[]> {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.conversationService.listMessages(
      user.workspaceId!,
      id,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Post(":id/messages")
  async reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ReplyConversationDto,
  ): Promise<MessageSummary> {
    return this.conversationService.reply(user.workspaceId!, id, user.userId, dto.text);
  }

  @RequirePermission(Permission.REPLY_CONVERSATIONS)
  @Patch(":id/status")
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateConversationStatusDto,
  ): Promise<ConversationSummary> {
    return this.conversationService.updateStatus(user.workspaceId!, id, dto.status, user.userId);
  }

  @RequirePermission(Permission.ASSIGN_CONVERSATIONS)
  @Patch(":id/assign")
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AssignConversationDto,
  ): Promise<ConversationSummary> {
    return this.conversationService.assign(
      user.workspaceId!,
      id,
      dto.assignedToUserId,
      user.userId,
    );
  }

  @RequirePermission(Permission.ADD_INTERNAL_NOTES)
  @Post(":id/notes")
  async addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: CreateConversationNoteDto,
  ): Promise<ConversationNoteSummary> {
    return this.conversationService.addNote(user.workspaceId!, id, user.userId, dto.text);
  }

  @RequirePermission(Permission.ADD_INTERNAL_NOTES)
  @Get(":id/notes")
  async listNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ConversationNoteSummary[]> {
    return this.conversationService.listNotes(user.workspaceId!, id);
  }
}
