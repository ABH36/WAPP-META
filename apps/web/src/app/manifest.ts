import type { MetadataRoute } from "next";

/**
 * FRD-001 Volume-9 §4.3/§11 — Web App Manifest, `apps/web` only (Architecture
 * Review, 2026-08-12: apps/admin stays a standard authenticated console, no
 * install experience). Icons are a deliberate placeholder mark (brand-600
 * circle) — no real logo/brand asset exists in this repo yet; see
 * docs/TECH-DEBT.md.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WAPP — WhatsApp Business Platform",
    short_name: "WAPP",
    description:
      "Enterprise WhatsApp customer engagement platform for sales, support and team collaboration.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#4F46E5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
