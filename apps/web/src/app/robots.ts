import type { MetadataRoute } from "next";

/**
 * FRD-001 Volume-9 §4.9/§11, Architecture Review 2026-08-12 — SEO scope is
 * infrastructure only this volume; real per-page marketing SEO is deferred
 * until the Public Website module (PRD-008 Vol 2) actually ships content.
 * Disallows every authenticated `(workspace)` route (nothing to index —
 * private tenant data behind auth anyway) and the auth utility pages (no
 * SEO value); allows the public marketing surface, currently just `/`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/crm/",
        "/communication/",
        "/billing/",
        "/settings/",
        "/workspace/",
        "/profile/",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/offline",
      ],
    },
    // `NEXT_PUBLIC_APP_URL` is already an established env var (see
    // apps/web/.env.example) — no fabricated production domain fallback
    // here; each environment's real configured value is authoritative.
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
