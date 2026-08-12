import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Only apps/web gets a service worker (Architecture Review, 2026-08-12 —
  // apps/admin stays a standard authenticated console, no PWA/offline).
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone", // required for docker/web.Dockerfile's minimal runtime image
  transpilePackages: ["@wapp/ui", "@wapp/shared-types", "@wapp/shared-validation"],
  images: {
    // DS-001 §2 / TAD-001 Storage decision — Cloudinary is the only approved
    // image origin beyond same-origin assets.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  experimental: {
    // FRD-001 Volume-9 §4.1/§4.9 — per-icon/per-component tree-shaking for
    // these two barrel-file packages, so importing one lucide icon or one
    // recharts primitive doesn't pull the whole library into every chunk
    // that touches it.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default withSerwist(nextConfig);
