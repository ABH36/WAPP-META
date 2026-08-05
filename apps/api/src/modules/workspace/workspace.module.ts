import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { Workspace, WorkspaceSchema } from "./schemas/workspace.schema.js";
import {
  WorkspaceInvitation,
  WorkspaceInvitationSchema,
} from "./schemas/workspace-invitation.schema.js";
import { WorkspaceRepository } from "./repositories/workspace.repository.js";
import { WorkspaceInvitationRepository } from "./repositories/workspace-invitation.repository.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { TeamService } from "./services/team.service.js";
import { WorkspaceController } from "./controllers/workspace.controller.js";
import { TeamController } from "./controllers/team.controller.js";

/**
 * Workspace & Tenant Management (Phase-3 — SDP-001 Module Development
 * Order). Owns the `workspaces` and `workspace_invitations` collections.
 * Depends on IdentityModule for UserRepository (the `users` collection
 * stays exclusively Identity's — SAD-002 DB-001) and AuthService
 * (reissueTokens/revokeAllSessions) rather than reaching into Identity's
 * internals directly.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceInvitation.name, schema: WorkspaceInvitationSchema },
    ]),
    InfrastructureModule,
    IdentityModule,
  ],
  controllers: [WorkspaceController, TeamController],
  providers: [WorkspaceRepository, WorkspaceInvitationRepository, WorkspaceService, TeamService],
  // WorkspaceRepository exported for Communication's Automation Engine
  // (Part 4a) — reads Workspace.businessHours to gate Welcome/Away
  // messages, the same cross-module dependency pattern Communication
  // already uses for Identity's UserRepository.
  exports: [WorkspaceRepository],
})
export class WorkspaceModule {}
