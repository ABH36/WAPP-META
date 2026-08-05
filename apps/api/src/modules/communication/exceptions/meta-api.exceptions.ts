import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Typed Graph API failure classes — see docs/COMM-META-ERROR-HANDLING-STRATEGY.md
 * for the full classification rationale and what each category means for
 * future retry behavior (not implemented yet; classification only).
 */
export abstract class MetaApiException extends HttpException {
  constructor(status: HttpStatus, message: string) {
    super(message, status);
  }
}

/** The request itself was malformed — never safe to retry unmodified. */
export class MetaValidationException extends MetaApiException {
  constructor(message: string) {
    super(HttpStatus.BAD_REQUEST, message);
  }
}

/**
 * Expired/invalid/revoked token (Meta error code 190) or an HTTP 401/403.
 * Deliberately NOT surfaced as our own 401 — that would misleadingly imply
 * the caller's own WAPP session is invalid, when it's actually the
 * workspace's WhatsApp connection that needs reconnecting.
 */
export class MetaAuthenticationException extends MetaApiException {
  constructor(message: string) {
    super(HttpStatus.FAILED_DEPENDENCY, message);
  }
}

/** HTTP 429 — safe to retry after `retryAfterSeconds` once retry logic exists. */
export class MetaRateLimitException extends MetaApiException {
  readonly retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null) {
    super(HttpStatus.TOO_MANY_REQUESTS, message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** HTTP 5xx or Meta's own `is_transient: true` marker — safe to retry with backoff. */
export class MetaTemporaryException extends MetaApiException {
  constructor(message: string) {
    super(HttpStatus.SERVICE_UNAVAILABLE, message);
  }
}

/** Anything not matching a known category — fail fast, do not retry blindly. */
export class MetaUnknownException extends MetaApiException {
  constructor(message: string) {
    super(HttpStatus.INTERNAL_SERVER_ERROR, message);
  }
}
