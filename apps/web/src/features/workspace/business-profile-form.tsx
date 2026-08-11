"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Alert, Button, Input, SkeletonText, Textarea } from "@wapp/ui";
import { workspaceService } from "../../services/workspace.service";
import { useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

const businessProfileSchema = z.object({
  category: z.string().max(80, "Must be 80 characters or fewer"),
  description: z.string().max(500, "Must be 500 characters or fewer"),
  gstin: z.string(),
});

type BusinessProfileValues = z.infer<typeof businessProfileSchema>;

/**
 * FRD-001 Volume-3 §4.2 — only `category`/`description`/`gstin` are
 * editable (the real `UpdateBusinessProfileDto` shape). `Name` is
 * displayed read-only — no update route exists for it anywhere.
 * `Website`/`Address` were dropped entirely (Architecture Review,
 * 2026-08-10) — the backend has no such fields.
 */
export function BusinessProfileForm(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = useHasPermission(Permission.EDIT_WORKSPACE);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const workspaceQuery = useQuery({
    queryKey: ["workspace", "current"],
    queryFn: () => workspaceService.current(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<BusinessProfileValues>({
    resolver: zodResolver(businessProfileSchema),
    values: workspaceQuery.data
      ? {
          category: workspaceQuery.data.businessProfile.category ?? "",
          description: workspaceQuery.data.businessProfile.description ?? "",
          gstin: workspaceQuery.data.businessProfile.gstin ?? "",
        }
      : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const updated = await workspaceService.updateBusinessProfile({
        category: values.category || null,
        description: values.description || null,
        gstin: values.gstin || null,
      });
      queryClient.setQueryData(["workspace", "current"], updated);
      setSuccessMessage("Business profile updated.");
      reset(values);
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    }
  });

  if (workspaceQuery.isLoading) {
    return <SkeletonText lines={5} />;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? <Alert variant="danger">{formError}</Alert> : null}
      {successMessage ? <Alert variant="info">{successMessage}</Alert> : null}
      {!canEdit ? (
        <Alert variant="info">
          Only the workspace Owner or Administrator can edit the business profile.
        </Alert>
      ) : null}

      <div>
        <p className="text-body-sm mb-1 font-medium text-neutral-700 dark:text-neutral-300">
          Business name
        </p>
        <p className="text-body text-neutral-900 dark:text-neutral-50">
          {workspaceQuery.data?.name ?? "—"}
        </p>
      </div>

      <div>
        <label
          htmlFor="category"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Category
        </label>
        <Input
          id="category"
          disabled={!canEdit}
          error={!!errors.category}
          {...register("category")}
        />
        {errors.category ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.category.message}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="description"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          Description
        </label>
        <Textarea
          id="description"
          disabled={!canEdit}
          error={!!errors.description}
          {...register("description")}
        />
        {errors.description ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.description.message}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="gstin"
          className="text-body-sm mb-1 block font-medium text-neutral-700 dark:text-neutral-300"
        >
          GSTIN
        </label>
        <Input id="gstin" disabled={!canEdit} error={!!errors.gstin} {...register("gstin")} />
        {errors.gstin ? (
          <p className="text-body-sm text-danger-700 mt-1">{errors.gstin.message}</p>
        ) : null}
      </div>

      {canEdit ? (
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          disabled={!isDirty}
          className="w-fit"
        >
          Save changes
        </Button>
      ) : null}
    </form>
  );
}
