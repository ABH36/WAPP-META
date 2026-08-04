import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import type { AppConfig } from "../../../config/configuration.js";

/**
 * Sole owner of password hashing (bcrypt) — chosen over Argon2 for Phase-1
 * because it needs zero native-binding-vs-platform risk beyond what's already
 * proven in this stack and is the most widely audited option for a Node/NestJS
 * API; revisiting to Argon2id is a reasonable future hardening step, not a
 * Phase-1 blocker. Salt rounds are environment-configurable
 * (`BCRYPT_SALT_ROUNDS`, default 12) so test suites can lower cost without
 * touching production security posture.
 */
@Injectable()
export class PasswordService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  async hash(plainPassword: string): Promise<string> {
    const { bcryptSaltRounds } = this.config.get("auth", { infer: true });
    return bcrypt.hash(plainPassword, bcryptSaltRounds);
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
