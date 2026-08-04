import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone", // required for docker/admin.Dockerfile's minimal runtime image
  transpilePackages: ["@wapp/ui", "@wapp/shared-types", "@wapp/shared-validation"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
