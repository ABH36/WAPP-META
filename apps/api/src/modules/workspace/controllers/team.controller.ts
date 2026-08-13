import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Permission, TenantRole } from "@wapp/shared-types";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RequirePermission } from "../../identity/decorators/require-permission.decorator.js";
import { RefreshCookieService } from "../../../common/security/refresh-cookie.service.js";
import { TENANT_REFRESH_TOKEN_COOKIE } from "../../identity/identity.constants.js";
import type {
  AccessTokenIssued,
  AuthenticatedUser,
  IssuedTokenPair,
} from "../../identity/identity.types.js";
import { TeamService } from "../services/team.service.js";
import { InviteTeamMemberDto } from "../dto/invite-team-member.dto.js";
import { AcceptInvitationDto } from "../dto/accept-invitation.dto.js";
import { UpdateMemberRoleDto } from "../dto/update-member-role.dto.js";
import type { InvitationSummary, MemberSummary, WorkspaceProfile } from "../workspace.types.js";

@Controller({ path: "team", version: "1" })
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly refreshCookies: RefreshCookieService,
  ) {}

  @RequirePermission(Permission.INVITE_USER)
  @Post("invitations")
  async invite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteTeamMemberDto,
  ): Promise<{ message: string }> {
    await this.teamService.inviteMember(user.workspaceId!, user.userId, dto);
    return { message: "Invitation sent" };
  }

  @RequirePermission(Permission.INVITE_USER)
  @Get("invitations")
  async listInvitations(@CurrentUser() user: AuthenticatedUser): Promise<InvitationSummary[]> {
    return this.teamService.listInvitations(user.workspaceId!);
  }

  @RequirePermission(Permission.INVITE_USER)
  @HttpCode(HttpStatus.OK)
  @Delete("invitations/:id")
  async revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<{ message: string }> {
    await this.teamService.revokeInvitation(user.workspaceId!, id);
    return { message: "Invitation revoked" };
  }

  // No @RequirePermission() — the accepting user typically has no workspace
  // (and therefore no role) yet. Authentication alone is the correct gate.
  @Post("invitations/accept")
  async acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ workspace: WorkspaceProfile; tokens: AccessTokenIssued }> {
    const { workspace, tokens } = await this.teamService.acceptInvitation(
      user,
      dto.token,
      this.extractMeta(request),
    );
    this.setRefreshCookie(response, tokens);
    return { workspace, tokens: toAccessTokenIssued(tokens) };
  }

  @RequirePermission(Permission.VIEW_WORKSPACE)
  @Get("members")
  async listMembers(@CurrentUser() user: AuthenticatedUser): Promise<MemberSummary[]> {
    return this.teamService.listMembers(user.workspaceId!);
  }

  @RequirePermission(Permission.MANAGE_ROLES)
  @Patch("members/:userId/role")
  async updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<MemberSummary> {
    return this.teamService.updateMemberRole(user.workspaceId!, userId, dto);
  }

  @RequirePermission(Permission.REMOVE_USER)
  @HttpCode(HttpStatus.OK)
  @Post("members/:userId/suspend")
  async suspendMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
  ): Promise<{ message: string }> {
    await this.teamService.suspendMember(user.workspaceId!, userId, user.userId);
    return { message: "Member suspended" };
  }

  @RequirePermission(Permission.REMOVE_USER)
  @HttpCode(HttpStatus.OK)
  @Post("members/:userId/reactivate")
  async reactivateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
  ): Promise<{ message: string }> {
    await this.teamService.reactivateMember(user.workspaceId!, userId, user.userId);
    return { message: "Member reactivated" };
  }

  @RequirePermission(Permission.REMOVE_USER)
  @HttpCode(HttpStatus.OK)
  @Delete("members/:userId")
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
  ): Promise<{ message: string }> {
    await this.teamService.removeMember(user.workspaceId!, userId);
    return { message: "Member removed" };
  }

  // Coarse MANAGE_ROLES permission gate, plus a hardcoded Owner-only check
  // below (Stage-4 resource-level rule — PRD-002 Part 3B §F: Administrator
  // also holds MANAGE_ROLES, but must not be able to transfer ownership
  // away from the Owner).
  @RequirePermission(Permission.MANAGE_ROLES)
  @HttpCode(HttpStatus.OK)
  @Post("ownership-transfer/:newOwnerId")
  async transferOwnership(
    @CurrentUser() user: AuthenticatedUser,
    @Param("newOwnerId") newOwnerId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenIssued> {
    if (user.role !== TenantRole.OWNER) {
      throw new ForbiddenException("Only the current Owner can transfer ownership");
    }
    const tokens = await this.teamService.transferOwnership(
      user.workspaceId!,
      user.userId,
      newOwnerId,
      this.extractMeta(request),
    );
    this.setRefreshCookie(response, tokens);
    return toAccessTokenIssued(tokens);
  }

  private setRefreshCookie(response: Response, tokens: IssuedTokenPair): void {
    this.refreshCookies.set(
      response,
      TENANT_REFRESH_TOKEN_COOKIE,
      tokens.refreshToken,
      tokens.rememberMe,
      tokens.refreshTokenExpiresAt,
    );
  }

  private extractMeta(request: Request): { userAgent: string | null; ipAddress: string | null } {
    return {
      userAgent: request.headers["user-agent"] ?? null,
      ipAddress: request.ip ?? null,
    };
  }
}

function toAccessTokenIssued(tokens: IssuedTokenPair): AccessTokenIssued {
  return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
}
