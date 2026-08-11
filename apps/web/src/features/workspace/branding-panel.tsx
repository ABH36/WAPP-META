"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Permission } from "@wapp/shared-types";
import { Building2, Trash2, Upload } from "lucide-react";
import { Alert, Button, SkeletonCard } from "@wapp/ui";
import { settingsService } from "../../services/settings.service";
import { uploadLogoToCloudinary } from "../../lib/cloudinary-upload";
import { useHasPermission } from "../../lib/permissions";
import { ApiError } from "../../lib/api";

/**
 * FRD-001 Volume-3 §4.4 — reuses the existing signed-upload flow exactly:
 * get signature → upload direct to Cloudinary → confirm (`PATCH .../logo`).
 * "Replace Logo" is the identical flow, not a separate code path — it
 * naturally supersedes the existing asset (the backend deletes the old
 * Cloudinary asset on confirm). "Remove Logo" is the one genuinely
 * distinct route (`DELETE .../logo`).
 */
export function BrandingPanel(): React.JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = useHasPermission(Permission.EDIT_WORKSPACE);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings", "overview"],
    queryFn: () => settingsService.overview(),
    enabled: canEdit,
  });

  if (!canEdit) {
    return (
      <Alert variant="info">
        Only the workspace Owner or Administrator can view or change branding.
      </Alert>
    );
  }

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const signature = await settingsService.getLogoUploadSignature();
      const uploaded = await uploadLogoToCloudinary(file, signature);
      const updated = await settingsService.confirmLogo({
        logoUrl: uploaded.secure_url,
        logoPublicId: uploaded.public_id,
      });
      queryClient.setQueryData(["settings", "overview"], updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Logo upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      const updated = await settingsService.removeLogo();
      queryClient.setQueryData(["settings", "overview"], updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (settingsQuery.isLoading) {
    return <SkeletonCard />;
  }

  const logoUrl = settingsQuery.data?.branding.logoUrl;

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert variant="danger">{error}</Alert> : null}

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
          {logoUrl ? (
            <img src={logoUrl} alt="Workspace logo" className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-8 w-8 text-neutral-400" aria-hidden />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleFileSelected(event)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          {logoUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={busy}
              onClick={() => void handleRemove()}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Remove logo
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
