import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone", // required for docker/admin.Dockerfile's minimal runtime image
  transpilePackages: ["@wapp/ui", "@wapp/shared-types", "@wapp/shared-validation"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  experimental: {
    // FRD-001 Volume-9 §4.1/§4.9 — see apps/web/next.config.ts's identical note.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
