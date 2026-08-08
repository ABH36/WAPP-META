import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type { AppConfig } from "../../../config/configuration.js";

/**
 * PRD-007 Volume-1 — a small, deliberate duplicate of Identity's
 * `PasswordService`, not a shared import. The Architect's approval was
 * explicit that Platform authentication is "implemented independently" —
 * zero shared providers with the tenant Identity module, even for a
 * stateless bcrypt wrapper this small. Reuses the same `auth.
 * bcryptSaltRounds` config value (a cost-factor number, not a secret —
 * no isolation concern in sharing it). See
 * docs/ADR-PLAT-002-platform-identity-strategy.md.
 */
@Injectable()
export class PlatformPasswordService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async hash(plainPassword: string): Promise<string> {
    const { bcryptSaltRounds } = this.config.get("auth", { infer: true });
    return bcrypt.hash(plainPassword, bcryptSaltRounds);
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
