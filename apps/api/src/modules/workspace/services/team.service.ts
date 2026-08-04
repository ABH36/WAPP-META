import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TenantRole, WorkspaceMemberStatus } from "@wapp/shared-types";
import type { AppConfig } from "../../../config/configuration.js";
import { EmailService } from "../../../infrastructure/email/email.service.js";
import { UserRepository } from "../../identity/repositories/user.repository.js";
import { TokenService } from "../../identity/services/token.service.js";
import { AuthService, type RequestMeta } from "../../identity/services/auth.service.js";
import type { AuthenticatedUser, IssuedTokenPair } from "../../identity/identity.types.js";
import { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { WorkspaceInvitationRepository } from "../repositories/workspace-invitation.repository.js";
import { buildInvitationEmail } from "../emails/workspace-email.templates.js";
import {
  toInvitationSummary,
  toMemberSummary,
  toWorkspaceProfile,
} from "../mappers/workspace.mapper.js";
import type { InvitationSummary, MemberSummary, WorkspaceProfile } from "../workspace.types.js";
import type { InviteTeamMemberDto } from "../dto/invite-team-member.dto.js";
import type { UpdateMemberRoleDto } from "../dto/update-member-role.dto.js";

/**
 * Team/membership lifecycle: invitations, acceptance, role changes,
 * suspend/reactivate/remove, ownership transfer. Kept separate from
 * WorkspaceService (settings/profile) — different concern, same pattern
 * Identity used to split AuthService responsibilities across services.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly invitationRepository: WorkspaceInvitationRepository,
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async inviteMember(
    workspaceId: string,
    invitedBy: string,
    dto: InviteTeamMemberDto,
  ): Promise<void> {
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const existingUser = await this.userRepository.findByEmail(dto.email);
    // PRD-002 v1.1 — Phase-1 is strictly one User -> one Workspace. A user
    // already belonging to *any* workspace (this one or another) cannot be
    // invited again — the "existing user joins a second Workspace" flow was
    // explicitly removed from Phase-1 scope.
    if (existingUser?.workspaceId) {
      throw new ConflictException(
        "This email already belongs to a workspace and cannot be invited again",
      );
    }

    const existingInvitation = await this.invitationRepository.findPendingByWorkspaceAndEmail(
      workspaceId,
      dto.email,
    );
    if (existingInvitation) {
      // Idempotent re-invite: replace the old pending invitation with a
      // fresh one rather than erroring, so "resend invite" is just calling
      // this endpoint again.
      await this.invitationRepository.markRevoked(existingInvitation._id.toString());
    }

    const { invitationTokenTtlDays } = this.config.get("workspace", { infer: true });
    const rawToken = this.tokenService.generateOpaqueToken();

    await this.invitationRepository.create({
      workspaceId,
      email: dto.email,
      role: dto.role,
      invitedBy,
      tokenHash: this.tokenService.hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + invitationTokenTtlDays * 86_400_000),
    });

    const { web } = this.config.get("urls", { infer: true });
    const inviteLink = `${web}/accept-invitation?token=${rawToken}`;
    const { subject, html, text } = buildInvitationEmail(workspace.name, inviteLink);
    await this.emailService.send({
      to: dto.email,
      subject,
      html,
      text,
      category: "team-invitation",
    });
  }

  async listInvitations(workspaceId: string): Promise<InvitationSummary[]> {
    const invitations = await this.invitationRepository.findByWorkspace(workspaceId);
    return invitations.map(toInvitationSummary);
  }

  async revokeInvitation(workspaceId: string, invitationId: string): Promise<void> {
    const invitation = await this.invitationRepository.findByIdForWorkspace(
      workspaceId,
      invitationId,
    );
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }
    await this.invitationRepository.markRevoked(invitationId);
  }

  async acceptInvitation(
    currentUser: AuthenticatedUser,
    rawToken: string,
    meta: RequestMeta,
  ): Promise<{ workspace: WorkspaceProfile; tokens: IssuedTokenPair }> {
    const tokenHash = this.tokenService.hashOpaqueToken(rawToken);
    const invitation = await this.invitationRepository.findPendingByHash(tokenHash);

    if (!invitation || invitation.expiresAt < new Date()) {
      throw new BadRequestException("This invitation is invalid or has expired");
    }

    const user = await this.userRepository.findById(currentUser.userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.email !== invitation.email) {
      throw new ForbiddenException(
        "This invitation was sent to a different email address. Log in as that email to accept it.",
      );
    }
    if (user.workspaceId) {
      throw new ConflictException("You already belong to a workspace");
    }

    const workspace = await this.workspaceRepository.findById(invitation.workspaceId.toString());
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    await this.userRepository.assignWorkspaceMembership(
      user._id.toString(),
      invitation.workspaceId.toString(),
      invitation.role,
      WorkspaceMemberStatus.ACTIVE,
    );
    await this.invitationRepository.markAccepted(invitation._id.toString());

    const tokens = await this.authService.reissueTokens(user._id.toString(), meta);

    return { workspace: toWorkspaceProfile(workspace), tokens };
  }

  async listMembers(workspaceId: string): Promise<MemberSummary[]> {
    const members = await this.userRepository.findWorkspaceMembers(workspaceId);
    return members.map(toMemberSummary);
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberSummary> {
    const target = await this.getMemberOrThrow(workspaceId, targetUserId);
    if (target.role === TenantRole.OWNER) {
      throw new ForbiddenException(
        "The workspace Owner's role cannot be changed here — use the ownership transfer action instead",
      );
    }

    await this.userRepository.updateWorkspaceRole(targetUserId, dto.role);
    const updated = await this.getMemberOrThrow(workspaceId, targetUserId);
    return toMemberSummary(updated);
  }

  async suspendMember(workspaceId: string, targetUserId: string): Promise<void> {
    const target = await this.getMemberOrThrow(workspaceId, targetUserId);
    if (target.role === TenantRole.OWNER) {
      throw new ForbiddenException("The workspace Owner cannot be suspended");
    }

    await this.userRepository.updateWorkspaceMemberStatus(
      targetUserId,
      WorkspaceMemberStatus.SUSPENDED,
    );
    // PRD-002 Part 3B — Suspended still consumes a seat; only login is blocked.
    await this.authService.revokeAllSessions(targetUserId);
  }

  async reactivateMember(workspaceId: string, targetUserId: string): Promise<void> {
    const target = await this.getMemberOrThrow(workspaceId, targetUserId);
    if (target.workspaceMemberStatus !== WorkspaceMemberStatus.SUSPENDED) {
      throw new BadRequestException("Only a suspended member can be reactivated");
    }
    await this.userRepository.updateWorkspaceMemberStatus(
      targetUserId,
      WorkspaceMemberStatus.ACTIVE,
    );
  }

  async removeMember(workspaceId: string, targetUserId: string): Promise<void> {
    const target = await this.getMemberOrThrow(workspaceId, targetUserId);
    if (target.role === TenantRole.OWNER) {
      throw new ForbiddenException("The workspace Owner cannot be removed");
    }

    await this.userRepository.updateWorkspaceMemberStatus(
      targetUserId,
      WorkspaceMemberStatus.REMOVED,
    );
    await this.authService.revokeAllSessions(targetUserId);
  }

  /**
   * PRD-002 Part 3B §F — only the current Owner may initiate a transfer
   * (enforced by the caller checking `actingUser.role === OWNER` before
   * calling this — a Stage-4 resource-level rule, deliberately not folded
   * into the coarse MANAGE_ROLES permission check since Administrator also
   * holds that permission but must not be able to transfer ownership away
   * from the Owner). The outgoing Owner is demoted to Administrator, not
   * left roleless.
   */
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string,
    meta: RequestMeta,
  ): Promise<IssuedTokenPair> {
    if (currentOwnerId === newOwnerId) {
      throw new BadRequestException("You are already the Owner");
    }

    const newOwner = await this.getMemberOrThrow(workspaceId, newOwnerId);
    if (newOwner.workspaceMemberStatus !== WorkspaceMemberStatus.ACTIVE) {
      throw new BadRequestException("Only an active member can become the new Owner");
    }

    await this.userRepository.updateWorkspaceRole(newOwnerId, TenantRole.OWNER);
    await this.userRepository.updateWorkspaceRole(currentOwnerId, TenantRole.ADMINISTRATOR);
    await this.workspaceRepository.updateOwner(workspaceId, newOwnerId);

    // Reissue for the acting (outgoing) user only — see reissueTokens' own
    // doc comment for why this isn't done for the other party too.
    return this.authService.reissueTokens(currentOwnerId, meta);
  }

  private async getMemberOrThrow(workspaceId: string, userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user || user.workspaceId !== workspaceId) {
      throw new NotFoundException("Member not found in this workspace");
    }
    return user;
  }
}
