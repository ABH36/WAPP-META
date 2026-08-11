"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Plus, RefreshCw } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Select,
  SkeletonCard,
  TemplateCard,
  Textarea,
} from "@wapp/ui";
import { templateService, type TemplateComponentPayload } from "../../services/template.service";
import { useHasFullPermission, useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";
import type { TemplateCategory, TemplateSummary } from "../../types/template";

const CATEGORIES: TemplateCategory[] = ["MARKETING", "UTILITY", "AUTHENTICATION"];

/**
 * FRD-001 Volume-4 §4.7 — List/Create/Preview/Sync. No edit or delete
 * route exists (Architecture Review, 2026-08-11: "Edit" is create-a-new-
 * revision, never a PATCH; Delete is unsupported entirely). Approval
 * status is pull-sync only (`POST .../templates/sync`) — the "Sync from
 * Meta" button is the only way `status`/`rejectionReason` ever update.
 * Create only supports a single BODY component this volume — Header/
 * Footer/Buttons authoring is deferred (scope cut, not a backend gap:
 * `CreateTemplateDto` supports them, this form just doesn't expose them
 * yet). The read itself is gated `VIEW_TEMPLATES`, `NONE` for
 * `SALES_EXECUTIVE`/`SUPPORT_MANAGER`/`SUPPORT_EXECUTIVE`.
 */
export function TemplateList(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canView = useHasPermission(Permission.VIEW_TEMPLATES);
  const canCreate = useHasFullPermission(Permission.CREATE_TEMPLATES);
  const canManage = useHasFullPermission(Permission.MANAGE_TEMPLATES);
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<TemplateCategory>("UTILITY");
  const [language, setLanguage] = React.useState("en_US");
  const [bodyText, setBodyText] = React.useState("");
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submittingForReview, setSubmittingForReview] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["communication", "templates"],
    queryFn: () => templateService.list(),
    enabled: canView,
  });

  const handleCreate = async () => {
    if (!name.trim() || !bodyText.trim()) {
      setFormError("Name and body text are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const components: TemplateComponentPayload[] = [{ type: "BODY", text: bodyText.trim() }];
      await templateService.create({ name: name.trim(), category, language, components });
      setName("");
      setBodyText("");
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ["communication", "templates"] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create template.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForReview = async (templateId: string) => {
    setSubmittingForReview(true);
    setFormError(null);
    try {
      await templateService.submit(templateId);
      await queryClient.invalidateQueries({ queryKey: ["communication", "templates"] });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to submit template for review.");
    } finally {
      setSubmittingForReview(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await templateService.sync();
      await queryClient.invalidateQueries({ queryKey: ["communication", "templates"] });
    } catch {
      // Sync failures are non-critical (approval status just stays as last known) — no blocking error UI.
    } finally {
      setSyncing(false);
    }
  };

  const previewTemplate: TemplateSummary | undefined = (templatesQuery.data ?? []).find(
    (t) => t.id === previewId,
  );

  if (!canView) {
    return <Alert variant="info">You don&apos;t have access to Templates.</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {canCreate ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New template
          </Button>
        ) : null}
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={syncing}
            onClick={() => void handleSync()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Sync from Meta
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          {formError ? <Alert variant="danger">{formError}</Alert> : null}
          <input
            aria-label="Template name"
            placeholder="template_name (lowercase_snake_case)"
            className="text-body-sm h-9 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Select
            aria-label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value as TemplateCategory)}
          >
            {CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <input
            aria-label="Language"
            placeholder="en_US"
            className="text-body-sm h-9 w-32 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />
          <Textarea
            aria-label="Body text"
            placeholder="Hello {{1}}, your order {{2}} has shipped."
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
          />
          <Button
            type="button"
            variant="primary"
            loading={submitting}
            className="w-fit"
            onClick={() => void handleCreate()}
          >
            Save as draft
          </Button>
        </div>
      ) : null}

      {templatesQuery.isLoading ? (
        <SkeletonCard />
      ) : (templatesQuery.data ?? []).length === 0 ? (
        <EmptyState title="No templates" description="Templates you create will appear here." />
      ) : (
        <div className="flex flex-col gap-3">
          {(templatesQuery.data ?? []).map((template) => (
            <TemplateCard
              key={template.id}
              name={template.name}
              category={template.category}
              language={template.language}
              status={template.status}
              rejectionReason={template.rejectionReason}
              onClick={() =>
                setPreviewId((current) => (current === template.id ? null : template.id))
              }
            />
          ))}
        </div>
      )}

      {previewTemplate ? (
        <Card className="flex flex-col gap-2">
          <p className="text-body-sm font-medium text-neutral-700 dark:text-neutral-300">Preview</p>
          {previewTemplate.components.map((component, index) => (
            <p key={index} className="text-body-sm text-neutral-900 dark:text-neutral-50">
              {component.text ?? `[${component.format ?? component.type} placeholder]`}
            </p>
          ))}
          {canManage && previewTemplate.status === "DRAFT" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              loading={submittingForReview}
              onClick={() => void handleSubmitForReview(previewTemplate.id)}
            >
              Submit for review
            </Button>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
