# Workspace Branding Strategy

**Status:** Accepted
**Date:** 2026-08-07
**Scope:** PRD-006 Volume-1 §4 (Branding, Workspace Logo) — the relationship between StorageService and Workspace Branding
**Implemented in:** `apps/api/src/modules/settings/services/settings.service.ts`, `apps/api/src/infrastructure/storage/storage.service.ts`

## Settings owns the reference; StorageService owns the upload

`StorageService` (`apps/api/src/infrastructure/storage/`) already existed — Cloudinary-signed uploads, per SEC-016: the client uploads directly to Cloudinary using a short-lived signature the backend issues, so file bytes never pass through this API. It had zero consumers anywhere in this codebase before this volume, despite its own doc comment illustrating `workspaces/{workspaceId}/logos` as an example folder path — clearly built for exactly this use case and never wired up. Resolved 2026-08-07, Architecture Review: reuse it as-is rather than building new upload infrastructure.

The division of ownership is exact: `SettingsService.getLogoUploadSignature()` calls `StorageService.generateUploadSignature()` directly (a pure, synchronous signing operation — no network call, no Cloudinary round-trip) and returns the signature to the client unchanged. The client then uploads directly to Cloudinary. Only after that succeeds does the client call `PATCH /settings/branding/logo` with the resulting `logoUrl`/`logoPublicId`, which `WorkspaceSettingsRepository` persists as a plain reference. Settings never touches file bytes, never proxies an upload, and never calls Cloudinary to upload anything itself.

## Replacing or removing a logo cleans up the previous asset

`SettingsService.updateLogo()`/`removeLogo()` both check for an existing `logoPublicId` before writing and call `StorageService.deleteAsset()` on it first if one exists — avoiding orphaned files accumulating in Cloudinary storage every time a Workspace changes its logo. This is a direct, minimal consequence of Settings now being the sole owner of the reference: since nothing else in this codebase points at that Cloudinary asset, Settings is also the only thing that can know it's safe to delete.

## Branding today is exactly one field

§4 lists "Branding" and "Workspace Logo" as separate candidate rows, but §6 explicitly defers "Branding limitations? Logo size? Supported image types?" to a future Business Rules pass. Rather than inventing additional branding fields (colors, themes) that weren't concretely specified — which would be inventing configuration behavior, not implementing approved scope — `WorkspaceSettings.logoUrl`/`logoPublicId` are the entirety of Branding's implementation in Volume-1. Any richer branding concept is genuinely new scope for a future volume, not assumed here.
