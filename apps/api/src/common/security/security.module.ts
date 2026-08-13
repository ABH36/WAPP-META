import { Global, Module } from "@nestjs/common";
import { TokenEncryptionService } from "./token-encryption.service.js";
import { RefreshCookieService } from "./refresh-cookie.service.js";

/**
 * Generic, reusable security primitives not specific to any one business
 * module — TokenEncryptionService (WABA access tokens, PRD-003 Part 1) and
 * RefreshCookieService (PHD-001 Volume-1, httpOnly refresh-token cookie
 * issuance shared by the tenant and Platform Administration auth
 * boundaries). Any future module needing to store a third-party secret at
 * rest (a payment provider token, etc.) uses this too rather than rolling
 * its own encryption.
 */
@Global()
@Module({
  providers: [TokenEncryptionService, RefreshCookieService],
  exports: [TokenEncryptionService, RefreshCookieService],
})
export class SecurityModule {}
