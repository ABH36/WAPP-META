import { apiDelete, apiGet, apiPost } from "../lib/api";
import type { ApiKeyScope, ApiKeySummary, GeneratedApiKey } from "../types/settings";

export interface CreateApiKeyPayload {
  name: string;
  scope?: ApiKeyScope;
  expiresAt?: string;
}

/** FRD-001 Volume-7 §4.8 — `EDIT_WORKSPACE`. The raw secret (`rawKey`) is only ever present in `create`/`rotate`'s response — never stored client-side beyond the single confirmation render (BR-004). */
export const apiKeysService = {
  list(): Promise<ApiKeySummary[]> {
    return apiGet("/settings/api-keys");
  },

  create(payload: CreateApiKeyPayload): Promise<GeneratedApiKey> {
    return apiPost("/settings/api-keys", payload);
  },

  revoke(id: string): Promise<ApiKeySummary> {
    return apiDelete(`/settings/api-keys/${id}`);
  },

  rotate(id: string): Promise<GeneratedApiKey> {
    return apiPost(`/settings/api-keys/${id}/rotate`);
  },
};
