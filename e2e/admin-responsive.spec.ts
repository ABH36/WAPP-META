import { test, expect } from "@playwright/test";

/**
 * FRD-001 Volume-9 §4.7/§12 — real-browser responsive verification for
 * apps/admin's public/auth surface (port 3001; see web-responsive.spec.ts
 * for the full rationale — apps/admin has no PWA/offline scope of its own,
 * per the Architecture Review, so there's no equivalent offline-page check
 * here). Every test targets the second `webServer` entry in
 * playwright.config.ts explicitly via a full URL, since the config's
 * default `baseURL` isn't set (two apps, two ports, no single default).
 */
const ADMIN_URL = "http://localhost:3001";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Platform Administration login page", () => {
  test("renders the auth form with no horizontal overflow", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`);
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Protected Platform route without a session", () => {
  test("redirects to /login with redirectTo preserved", async ({ page }) => {
    await page.goto(`${ADMIN_URL}/workspaces`);
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fworkspaces/);
  });
});
