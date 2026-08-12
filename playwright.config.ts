import { defineConfig, devices } from "@playwright/test";

/**
 * FRD-001 Volume-9 §4.7/§12, Architecture Review 2026-08-12 — "Playwright
 * shall be introduced... Responsive verification shall be performed using
 * real browser rendering rather than manual inspection only." The first
 * browser-automation framework in this repo (previously: zero — every
 * prior volume's "responsive pass" was Tailwind breakpoint-class review,
 * confirmed absent by direct research before this volume began).
 *
 * Scope: both apps' `webServer`s boot for real, but tests only exercise
 * the public/auth surface (home, login, forgot-password, the PWA offline
 * page) — every authenticated route requires a real backend session, and
 * no `apps/api` instance exists in this environment (confirmed: no
 * database, no seeded test user). Full authenticated-flow coverage is
 * filed as Technical Debt, not silently skipped.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    // apps/web's origin — web-responsive.spec.ts uses relative paths
    // against this; admin-responsive.spec.ts uses fully-qualified
    // localhost:3001 URLs throughout and ignores this entirely.
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"] } },
    { name: "tablet", use: { ...devices["iPad Mini"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @wapp/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @wapp/admin dev",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
