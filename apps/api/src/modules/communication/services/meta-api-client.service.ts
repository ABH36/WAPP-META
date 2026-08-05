import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppConfig } from "../../../config/configuration.js";
import {
  MetaAuthenticationException,
  MetaRateLimitException,
  MetaTemporaryException,
  MetaUnknownException,
  MetaValidationException,
} from "../exceptions/meta-api.exceptions.js";

export interface MetaPhoneNumberDetails {
  displayPhoneNumber: string;
  verifiedName: string | null;
  qualityRating: string;
  messagingLimitTier: string | null;
}

export interface MetaTemplateComponentInput {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: Array<Record<string, unknown>>;
}

export interface CreateTemplateInput {
  name: string;
  category: string;
  language: string;
  components: MetaTemplateComponentInput[];
}

export interface MetaTemplateSummary {
  metaTemplateId: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: MetaTemplateComponentInput[];
  rejectedReason: string | null;
}

interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    is_transient?: boolean;
  };
}

/**
 * The only place `fetch` is called against Meta's Graph API — every other
 * class talks to Meta through this client, never directly (same "one owner
 * of the external integration surface" pattern as Identity's TokenService
 * owning all JWT operations). Uses Node's built-in `fetch` (Node >=20,
 * per package.json engines) — no HTTP client dependency needed for plain
 * JSON REST calls.
 *
 * NOT verified against the live Graph API as of this writing — doing so
 * requires a completed Embedded Signup (frontend UI not yet built) to
 * obtain a real authorization code/WABA. Covered by unit tests with
 * `fetch` mocked; flagged explicitly in the Phase-4 Part-1 completion
 * report as the one thing that still needs a live check once the frontend
 * exists.
 */
@Injectable()
export class MetaApiClient {
  private readonly logger = new Logger(MetaApiClient.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /** Embedded Signup step 2 — exchanges the short-lived authorization code the frontend received for a System User access token scoped to the customer's WABA. */
  async exchangeCodeForToken(code: string): Promise<string> {
    const { appId, appSecret } = this.config.get("meta", { infer: true });
    const url = new URL(`${this.baseUrl()}/oauth/access_token`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("client_secret", appSecret);
    url.searchParams.set("code", code);

    const body = await this.request<{ access_token: string }>(url, { method: "GET" });
    return body.access_token;
  }

  /** Subscribes WAPP's app to receive webhooks for this WABA — required once per connection, per Meta's docs. */
  async subscribeToWebhooks(wabaId: string, accessToken: string): Promise<void> {
    const url = new URL(`${this.baseUrl()}/${wabaId}/subscribed_apps`);
    await this.request(url, { method: "POST", accessToken });
  }

  async getWabaName(wabaId: string, accessToken: string): Promise<string | null> {
    const url = new URL(`${this.baseUrl()}/${wabaId}`);
    url.searchParams.set("fields", "name");
    const body = await this.request<{ name?: string }>(url, { method: "GET", accessToken });
    return body.name ?? null;
  }

  async getPhoneNumberDetails(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<MetaPhoneNumberDetails> {
    const url = new URL(`${this.baseUrl()}/${phoneNumberId}`);
    url.searchParams.set(
      "fields",
      "display_phone_number,verified_name,quality_rating,messaging_limit_tier",
    );
    const body = await this.request<{
      display_phone_number: string;
      verified_name?: string;
      quality_rating?: string;
      messaging_limit_tier?: string;
    }>(url, { method: "GET", accessToken });

    return {
      displayPhoneNumber: body.display_phone_number,
      verifiedName: body.verified_name ?? null,
      qualityRating: body.quality_rating ?? "UNKNOWN",
      messagingLimitTier: body.messaging_limit_tier ?? null,
    };
  }

  /** Sends a free-form text message — Part-1 scope; template messages belong to PRD-003 Part 3. */
  async sendTextMessage(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    text: string,
  ): Promise<string> {
    const url = new URL(`${this.baseUrl()}/${phoneNumberId}/messages`);
    const body = await this.request<{ messages: Array<{ id: string }> }>(url, {
      method: "POST",
      accessToken,
      jsonBody: {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      },
    });

    const messageId = body.messages[0]?.id;
    if (!messageId) {
      throw new MetaUnknownException("Meta did not return a message id");
    }
    return messageId;
  }

  /** Submits a new template for Meta review (WhatsApp Business Management API). */
  async createTemplate(
    wabaId: string,
    accessToken: string,
    input: CreateTemplateInput,
  ): Promise<{ metaTemplateId: string; status: string }> {
    const url = new URL(`${this.baseUrl()}/${wabaId}/message_templates`);
    const body = await this.request<{ id: string; status: string }>(url, {
      method: "POST",
      accessToken,
      jsonBody: {
        name: input.name,
        category: input.category,
        language: input.language,
        components: input.components,
      },
    });
    return { metaTemplateId: body.id, status: body.status };
  }

  /** Pulls the current template list + review status for a WABA — the sync path (TemplateService.syncFromMeta). */
  async listTemplates(wabaId: string, accessToken: string): Promise<MetaTemplateSummary[]> {
    const url = new URL(`${this.baseUrl()}/${wabaId}/message_templates`);
    url.searchParams.set("fields", "id,name,status,category,language,components,rejected_reason");
    const body = await this.request<{
      data: Array<{
        id: string;
        name: string;
        status: string;
        category: string;
        language: string;
        components: MetaTemplateComponentInput[];
        rejected_reason?: string;
      }>;
    }>(url, { method: "GET", accessToken });

    return body.data.map((item) => ({
      metaTemplateId: item.id,
      name: item.name,
      status: item.status,
      category: item.category,
      language: item.language,
      components: item.components,
      rejectedReason: item.rejected_reason ?? null,
    }));
  }

  /** Sends an approved template message — usable outside the 24h customer-service window (docs/COMM-COMPLIANCE-ENGINE.md), unlike sendTextMessage. */
  async sendTemplateMessage(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    templateName: string,
    languageCode: string,
    bodyParameters: string[],
  ): Promise<string> {
    const url = new URL(`${this.baseUrl()}/${phoneNumberId}/messages`);
    const body = await this.request<{ messages: Array<{ id: string }> }>(url, {
      method: "POST",
      accessToken,
      jsonBody: {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components:
            bodyParameters.length > 0
              ? [
                  {
                    type: "body",
                    parameters: bodyParameters.map((text) => ({ type: "text", text })),
                  },
                ]
              : [],
        },
      },
    });

    const messageId = body.messages[0]?.id;
    if (!messageId) {
      throw new MetaUnknownException("Meta did not return a message id");
    }
    return messageId;
  }

  private baseUrl(): string {
    const { graphApiVersion } = this.config.get("meta", { infer: true });
    return `https://graph.facebook.com/${graphApiVersion}`;
  }

  private async request<T>(
    url: URL,
    opts: { method: "GET" | "POST"; accessToken?: string; jsonBody?: unknown },
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (opts.accessToken) {
      headers.Authorization = `Bearer ${opts.accessToken}`;
    }
    if (opts.jsonBody) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.jsonBody ? JSON.stringify(opts.jsonBody) : undefined,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as MetaErrorBody;
      // Never leak the App Secret (part of the request URL for the token
      // exchange call) into logs — log the path only, not the full URL.
      this.logger.error(
        `Meta Graph API request failed: ${opts.method} ${url.pathname} -> ${response.status} ${errorBody.error?.message ?? "unknown error"}`,
      );
      throw this.classifyError(response, errorBody);
    }

    return response.json() as Promise<T>;
  }

  /** See docs/COMM-META-ERROR-HANDLING-STRATEGY.md for the full classification rationale. */
  private classifyError(response: Response, errorBody: MetaErrorBody): Error {
    const message = errorBody.error?.message ?? response.statusText ?? "Unknown Meta API error";

    // code 190 (OAuthException) — Meta's stable marker for expired/invalid/
    // revoked tokens across API versions; checked before HTTP status since
    // Meta doesn't always use 401/403 consistently for this case.
    if (errorBody.error?.code === 190 || response.status === 401 || response.status === 403) {
      return new MetaAuthenticationException(message);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
      return new MetaRateLimitException(
        message,
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
      );
    }

    // Meta's own retry-safety flag takes priority over a plain 5xx check —
    // it can be true even on a status code that isn't in the 5xx range.
    if (errorBody.error?.is_transient === true || response.status >= 500) {
      return new MetaTemporaryException(message);
    }

    if (response.status === 400) {
      return new MetaValidationException(message);
    }

    return new MetaUnknownException(message);
  }
}
