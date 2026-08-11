import { apiGet, apiPost } from "../lib/api";
import type { TemplateCategory, TemplateSummary } from "../types/template";

export interface TemplateComponentPayload {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  text?: string;
  buttons?: Array<Record<string, unknown>>;
}

export interface CreateTemplatePayload {
  name: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponentPayload[];
}

/**
 * FRD-001 Volume-4 §4.7 — no edit or delete route exists. Once submitted
 * (`status !== "DRAFT"`), a Template is immutable; `create()` is also the
 * mechanism for a "revised" template (a brand-new document, ADR-COMM-005).
 * Approval status is pull-sync only — `sync()` (`POST .../templates/sync`)
 * is the only way `status`/`rejectionReason` ever update; there is no
 * webhook push. `submit()` only succeeds from `DRAFT`.
 */
export const templateService = {
  list(): Promise<TemplateSummary[]> {
    return apiGet("/communication/templates");
  },

  getById(id: string): Promise<TemplateSummary> {
    return apiGet(`/communication/templates/${id}`);
  },

  create(payload: CreateTemplatePayload): Promise<TemplateSummary> {
    return apiPost("/communication/templates", payload);
  },

  submit(id: string): Promise<TemplateSummary> {
    return apiPost(`/communication/templates/${id}/submit`);
  },

  sync(): Promise<TemplateSummary[]> {
    return apiPost("/communication/templates/sync");
  },
};
