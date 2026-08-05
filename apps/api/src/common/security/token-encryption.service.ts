import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../config/configuration.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12; // 96-bit IV — the recommended/standard length for GCM.

/**
 * Symmetric, reversible encryption for secrets that must be *read back* later
 * (a WABA access token, PRD-003 Part 1) — unlike PasswordService (Identity),
 * which is deliberately one-way. Never used for anything a one-way hash
 * would serve instead.
 *
 * AES-256-GCM: authenticated encryption (a tampered ciphertext fails to
 * decrypt rather than silently returning garbage), keyed by
 * `TOKEN_ENCRYPTION_KEY` (32 random bytes, hex-encoded in env — TAD-001
 * SEC-007). Packed format: `${iv}.${authTag}.${ciphertext}`, each
 * base64url-encoded, so the result is a single plain string safe to store
 * in a Mongo string field.
 */
@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService<AppConfig, true>) {
    const hexKey: string = config.get("tokenEncryptionKey", { infer: true });
    this.key = Buffer.from(hexKey, "hex");
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, ciphertext].map((part) => part.toString("base64url")).join(".");
  }

  decrypt(packed: string): string {
    const [ivPart, authTagPart, ciphertextPart] = packed.split(".");
    if (!ivPart || !authTagPart || !ciphertextPart) {
      throw new Error("Malformed encrypted value");
    }

    const iv = Buffer.from(ivPart, "base64url");
    const authTag = Buffer.from(authTagPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
}
