import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone", // required for docker/web.Dockerfile's minimal runtime image
  transpilePackages: ["@wapp/ui", "@wapp/shared-types", "@wapp/shared-validation"],
  images: {
    // DS-001 §2 / TAD-001 Storage decision — Cloudinary is the only approved
    // image origin beyond same-origin assets.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
