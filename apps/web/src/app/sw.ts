/// <reference lib="webworker" />

import { CacheFirst, NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// FRD-001 Volume-9 §4.3/§4.4, Architecture Review 2026-08-12 — "Offline
// mode may cache only static assets and application shell. Authenticated
// API responses shall never be cached." `precacheEntries` (the Next.js
// build's static output, via Serwist's build-time manifest injection) and
// the two explicit `runtimeCaching` rules below are the *entire* caching
// surface — deliberately not Serwist's generic `defaultCache` preset,
// which caches a broader same-origin "others" bucket that risks catching
// something it shouldn't. Every request to `NEXT_PUBLIC_API_URL` (a
// different origin/port from this app, per `apps/web/.env.local`) matches
// no rule here and is never touched by this service worker — it always
// goes straight to the network, cached or not, exactly like without a
// service worker at all.
const runtimeCaching: RuntimeCaching[] = [
  {
    // Next.js static build output — immutable, content-hashed filenames.
    matcher: /^\/_next\/static\/.*/i,
    handler: new CacheFirst({ cacheName: "static-assets" }),
  },
  {
    // Same-origin images/fonts (the placeholder PWA icons, next/font files).
    matcher: ({ request }) => request.destination === "image" || request.destination === "font",
    handler: new CacheFirst({ cacheName: "static-media" }),
  },
  {
    // App shell navigations (HTML page requests) — NetworkFirst, not
    // CacheFirst: always prefer a live page over a cached one when online,
    // falling back to the cached shell only when the network is
    // unavailable (BR-005 "offline mode never performs mutations" — this
    // is a read-only navigation fallback, nothing more).
    matcher: ({ request }) => request.mode === "navigate",
    handler: new NetworkFirst({ cacheName: "app-shell", networkTimeoutSeconds: 5 }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Explicit update flow (§4.3/§11), not silent auto-activation — the new
  // worker waits until `install-prompt.tsx`'s update banner sends it a
  // `SKIP_WAITING` message after the user opts in.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: "/offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
