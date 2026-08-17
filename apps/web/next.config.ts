import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";

// PHD-001 Volume-3 §16 — no bundle-size baseline/budget tooling existed
// before this volume. `pnpm analyze` (ANALYZE=true) generates a static
// treemap report; a no-op wrapper otherwise, zero effect on a normal build.
const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "true",
});

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Only apps/web gets a service worker (Architecture Review, 2026-08-12 —
  // apps/admin stays a standard authenticated console, no PWA/offline).
  disable: process.env.NODE_ENV === "development",
});

// PHD-001 Volume-1 — apps/api's Helmet config (main.ts) only protects the
// API's own JSON responses; the actual HTML/JS/CSS this app serves had zero
// security headers before this volume. Mirrors apps/api's CSP/HSTS/
// frame-ancestors philosophy, adapted for what a Next.js app actually needs:
// `script-src 'unsafe-inline'` is required for Next's own hydration
// bootstrap script (no nonce-based CSP wiring exists in this app), the same
// documented tradeoff `style-src` already carries backend-side for
// Tailwind's dev-mode injection.
const apiOrigin = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).origin
  : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://res.cloudinary.com",
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}`,
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

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
  headers() {
    return Promise.resolve([{ source: "/(.*)", headers: securityHeaders }]);
  },
};

export default withBundleAnalyzer(withSerwist(nextConfig));
