import { Injectable } from "@nestjs/common";
import { AuthService } from "../../identity/services/auth.service.js";
import type { LoginHistorySummary, SessionSummary } from "../../identity/identity.types.js";

/**
 * PRD-006 Volume-2 §4.5-§4.7/§11. Pure orchestration — every method here is
 * a direct call-through to `AuthService` (Identity, exported by
 * `IdentityModule`), never a duplicated projection. Settings owns no
 * password/session/login-history data of its own. See
 * docs/ADR-SET-004-identity-orchestration-strategy.md.
 */
@Injectable()
export class SecuritySettingsService {
  constructor(private readonly authService: AuthService) {}

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.authService.changePassword(userId, currentPassword, newPassword);
  }

  async listSessions(userId: string): Promise<SessionSummary[]> {
    return this.authService.listSessions(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.authService.revokeSession(userId, sessionId);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.authService.logoutAllDevices(userId);
  }

  async getLoginHistory(userId: string): Promise<LoginHistorySummary[]> {
    return this.authService.getLoginHistory(userId);
  }
}
