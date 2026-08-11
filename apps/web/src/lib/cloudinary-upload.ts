import type { LogoUploadSignature } from "../types/settings";

/**
 * FRD-001 Volume-3 §4.4 — the client half of the signed-upload flow
 * (ADR-SET-002, SEC-016): uploads the file bytes directly to Cloudinary
 * using a signature the backend generated (`settingsService.getLogoUploadSignature`),
 * never proxying them through `apps/api`. The caller still has to confirm
 * the result via `settingsService.confirmLogo` — this function only
 * performs the direct upload and returns Cloudinary's own response.
 */
export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

export async function uploadLogoToCloudinary(
  file: File,
  signature: LogoUploadSignature,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", String(signature.timestamp));
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error("Logo upload failed. Please try again.");
  }

  return (await response.json()) as CloudinaryUploadResult;
}
