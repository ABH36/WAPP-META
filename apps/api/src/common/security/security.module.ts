import { Global, Module } from "@nestjs/common";
import { TokenEncryptionService } from "./token-encryption.service.js";

/**
 * Generic, reusable security primitives not specific to any one business
 * module — currently just TokenEncryptionService (WABA access tokens,
 * PRD-003 Part 1), but any future module needing to store a third-party
 * secret at rest (a payment provider token, etc.) uses this too rather
 * than rolling its own encryption.
 */
@Global()
@Module({
  providers: [TokenEncryptionService],
  exports: [TokenEncryptionService],
})
export class SecurityModule {}
