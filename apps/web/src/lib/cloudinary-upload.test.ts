import { describe, it, expect, vi, afterEach } from "vitest";
import { uploadLogoToCloudinary } from "./cloudinary-upload";
import type { LogoUploadSignature } from "../types/settings";

const signature: LogoUploadSignature = {
  signature: "sig",
  timestamp: 1700000000,
  apiKey: "key",
  cloudName: "wapp",
  folder: "workspace-logos",
};

describe("uploadLogoToCloudinary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts to the workspace's Cloudinary cloud name and returns the parsed result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ secure_url: "https://res.cloudinary.com/logo.png", public_id: "abc123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const result = await uploadLogoToCloudinary(file, signature);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudinary.com/v1_1/wapp/image/upload",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual({
      secure_url: "https://res.cloudinary.com/logo.png",
      public_id: "abc123",
    });
  });

  it("throws when Cloudinary responds with a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    );

    const file = new File(["logo"], "logo.png", { type: "image/png" });
    await expect(uploadLogoToCloudinary(file, signature)).rejects.toThrow("Logo upload failed");
  });
});
