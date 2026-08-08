import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { User, UserSchema } from "./schemas/user.schema.js";
import { AuthToken, AuthTokenSchema } from "./schemas/auth-token.schema.js";
import { Session, SessionSchema } from "./schemas/session.schema.js";
import {
  LoginHistoryEntry,
  LoginHistoryEntrySchema,
} from "./schemas/login-history-entry.schema.js";
import { ApiKey, ApiKeySchema } from "./schemas/api-key.schema.js";
import {
  WorkspaceMaintenanceState,
  WorkspaceMaintenanceStateSchema,
} from "./schemas/workspace-maintenance-state.schema.js";
import {
  PlatformMaintenanceGate,
  PlatformMaintenanceGateSchema,
} from "./schemas/platform-maintenance-gate.schema.js";
import { UserRepository } from "./repositories/user.repository.js";
import { AuthTokenRepository } from "./repositories/auth-token.repository.js";
import { SessionRepository } from "./repositories/session.repository.js";
import { LoginHistoryRepository } from "./repositories/login-history.repository.js";
import { ApiKeyRepository } from "./repositories/api-key.repository.js";
import { WorkspaceMaintenanceStateRepository } from "./repositories/workspace-maintenance-state.repository.js";
import { PlatformMaintenanceGateRepository } from "./repositories/platform-maintenance-gate.repository.js";
import { PasswordService } from "./services/password.service.js";
import { TokenService } from "./services/token.service.js";
import { AuthService } from "./services/auth.service.js";
import { ApiKeyService } from "./services/api-key.service.js";
import { MaintenanceModeListener } from "./listeners/maintenance-mode.listener.js";
import { WorkspaceStatusGateListener } from "./listeners/workspace-status-gate.listener.js";
import { PlatformMaintenanceGateListener } from "./listeners/platform-maintenance-gate.listener.js";
import { AuthController } from "./controllers/auth.controller.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { PermissionsGuard } from "./guards/permissions.guard.js";
import { ApiKeyGuard } from "./guards/api-key.guard.js";

/**
 * Identity & Authentication (SDP-001 Module Development Order — first domain
 * module after Foundation). Owns the `users`, `auth_tokens`, and `sessions`
 * collections and registers the two global authorization guards (Stage 1 —
 * Authentication, Stage 3 — Capability Authorization; SAD-001 Volume-2 §6).
 * Declared here, not AppModule, so this module is fully self-contained: any
 * app that imports IdentityModule gets working global authentication without
 * extra AppModule wiring.
 *
 * `JwtModule.register({})` is intentionally empty — TokenService always
 * passes an explicit `secret`/`expiresIn` per call (access vs. refresh use
 * different secrets), so no module-level default is set here.
 */
@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AuthToken.name, schema: AuthTokenSchema },
      { name: Session.name, schema: SessionSchema },
      { name: LoginHistoryEntry.name, schema: LoginHistoryEntrySchema },
      { name: ApiKey.name, schema: ApiKeySchema },
      { name: WorkspaceMaintenanceState.name, schema: WorkspaceMaintenanceStateSchema },
      { name: PlatformMaintenanceGate.name, schema: PlatformMaintenanceGateSchema },
    ]),
    InfrastructureModule,
  ],
  controllers: [AuthController],
  providers: [
    UserRepository,
    AuthTokenRepository,
    SessionRepository,
    LoginHistoryRepository,
    ApiKeyRepository,
    WorkspaceMaintenanceStateRepository,
    PlatformMaintenanceGateRepository,
    PasswordService,
    TokenService,
    AuthService,
    ApiKeyService,
    ApiKeyGuard,
    MaintenanceModeListener,
    WorkspaceStatusGateListener,
    PlatformMaintenanceGateListener,
    // Order matters: JwtAuthGuard must populate request.user before
    // PermissionsGuard reads it — both declared in this same array/module so
    // Nest's global-guard registration order is guaranteed.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  // AuthService exported for reissueTokens() — the Workspace module calls it
  // after workspace creation / invitation acceptance so the acting user gets
  // an immediately-accurate token without a manual re-login. ApiKeyService
  // exported for PRD-006 Volume-3 — Settings' ApiKeysController is a thin
  // proxy over it (ADR-SET-005), same shape as SecuritySettingsService ->
  // AuthService.
  exports: [TokenService, UserRepository, AuthService, ApiKeyService],
})
export class IdentityModule {}
