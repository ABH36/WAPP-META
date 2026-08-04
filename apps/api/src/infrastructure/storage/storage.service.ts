import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import type { AppConfig } from "../../config/configuration.js";
import type { UploadSignature } from "./storage.types.js";

/**
 * Per TAD-001 v1.2 Security Patch (SEC-016): uploaded files bypass the NestJS
 * body parser entirely — the client uploads directly to Cloudinary using a
 * short-lived signature this service generates, never through our API's
 * request body. The backend keeps authority over *what's allowed to be
 * uploaded and where* (signing) and over deletion, without ever handling the
 * file bytes itself.
 */
@Injectable()
export class StorageService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const cloudinaryConfig = this.config.get("cloudinary", { infer: true });
    cloudinary.config({
      cloud_name: cloudinaryConfig.cloudName,
      api_key: cloudinaryConfig.apiKey,
      api_secret: cloudinaryConfig.apiSecret,
    });
  }

  /**
   * `folder` scopes the upload — callers pass a workspace-prefixed folder
   * (e.g. `workspaces/{workspaceId}/logos`) so tenant isolation extends to
   * object storage, not just the database (SAD-002 §6).
   */
  generateUploadSignature(folder: string): UploadSignature {
    const cloudinaryConfig = this.config.get("cloudinary", { infer: true });
    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      cloudinaryConfig.apiSecret,
    );

    return {
      signature,
      timestamp,
      apiKey: cloudinaryConfig.apiKey,
      cloudName: cloudinaryConfig.cloudName,
      folder,
    };
  }

  async deleteAsset(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
