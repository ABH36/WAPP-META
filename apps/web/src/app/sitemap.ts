import type { MetadataRoute } from "next";

/**
 * FRD-001 Volume-9 §4.9/§11 — SEO infrastructure only (Architecture
 * Review, 2026-08-12); lists exactly the real public, indexable pages
 * that exist today. Auth utility pages (`/login`, etc.) and every
 * authenticated `(workspace)` route are deliberately excluded — no SEO
 * value, and `robots.ts` already disallows crawling them. Grows one entry
 * at a time as the Public Website module (PRD-008 Vol 2) ships real
 * marketing pages — never pre-populated with routes that don't exist yet.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  return [
    {
      url: baseUrl ?? "/",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
