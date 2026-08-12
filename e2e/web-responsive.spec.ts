import { test, expect } from "@playwright/test";

/**
 * FRD-001 Volume-9 §4.7/§12 — real-browser responsive verification for
 * apps/web's public/auth surface, run across mobile/tablet/desktop
 * viewports (playwright.config.ts's three projects). The horizontal-
 * overflow check is the concrete class of bug manual Tailwind-class
 * review can't catch — an element wider than its viewport at a specific
 * breakpoint only shows up when actually rendered.
 */
async function expectNoHorizontalOverflow(page: import("@playwright/test").Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1); // 1px tolerance for sub-pixel rounding
}

test.describe("Home page", () => {
  test("renders the placeholder shell with no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "WAPP" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start Free Trial" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Login page", () => {
  test("renders the auth form with no horizontal overflow", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Forgot password page", () => {
  test("renders with no horizontal overflow", async ({ page }) => {
    await page.goto("/forgot-password");
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Offline fallback page", () => {
  test("renders the retry UI with no horizontal overflow", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Protected route without a session", () => {
  test("redirects to /login with redirectTo preserved", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdashboard/);
  });
});
