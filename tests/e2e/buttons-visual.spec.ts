import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const screenshotsDir = path.resolve(process.cwd(), "test-results/screenshots-ui");

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? "test.admin@guildclub.com",
  password: process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin@123",
};

test.describe("Visual & Functional Button System", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test("1. /dev/buttons gallery strict layout & geometry verification", async ({ page }) => {
    await page.goto("/dev/buttons");
    await page.locator("h1").waitFor({ timeout: 15000 });
    await page.locator(".btn").first().waitFor({ timeout: 10000 });

    // Capture full-page gallery screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "dev-buttons-gallery.png"),
      fullPage: true,
    });

    // Check heights and wrapping on all buttons
    const buttons = page.locator(".btn");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(15);

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const isVisible = await btn.isVisible();
      if (!isVisible) continue;

      const box = await btn.boundingBox();
      if (!box) continue;

      // Height assertion (allow +-2px for rendering engine subpixel borders)
      const allowedHeights = [36, 40, 44, 48];
      const matchesHeight = allowedHeights.some((h) => Math.abs(box.height - h) <= 2);
      expect(
        matchesHeight,
        `Button ${i} has height ${box.height}px which is not in [36, 40, 44, 48]`
      ).toBe(true);

      // Check non-overlap between SVG icon and label text
      const leadingIcon = btn.locator(".btn-icon svg").first();
      const trailingIcon = btn.locator(".btn-icon-trailing svg").first();
      const textSpan = btn.locator(".btn-label").first();

      const hasLeadingIcon = await leadingIcon.isVisible().catch(() => false);
      const hasTrailingIcon = await trailingIcon.isVisible().catch(() => false);
      const hasText = await textSpan.isVisible().catch(() => false);

      if (hasText) {
        const textBox = await textSpan.boundingBox();
        if (textBox && textBox.width > 0) {
          // Single-line text height check (14px font, leading-none <= 24px)
          expect(textBox.height).toBeLessThanOrEqual(24);

          if (hasLeadingIcon) {
            const leadingBox = await leadingIcon.boundingBox();
            if (leadingBox) {
              // Leading icon must be to the left of text without horizontal overlap
              expect(leadingBox.x + leadingBox.width).toBeLessThanOrEqual(textBox.x + 1);
            }
          }

          if (hasTrailingIcon) {
            const trailingBox = await trailingIcon.boundingBox();
            if (trailingBox) {
              // Trailing icon must be to the right of text without horizontal overlap
              expect(textBox.x + textBox.width).toBeLessThanOrEqual(trailingBox.x + 1);
            }
          }
        }
      }
    }
  });

  test("2. Admin login and dashboard tables kebab menu & responsiveness", async ({ page }) => {
    // 1. Login as Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 2. Viewport 1440px on /admin/therapists
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/therapists");
    await page.locator("table").waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, "therapists-1440px.png") });

    // Test Kebab Menu on first therapist row
    const firstKebab = page.locator('[data-testid^="row-actions-kebab-"]').first();
    if (await firstKebab.isVisible()) {
      await firstKebab.click();
      const menu = page.locator('[role="menu"]').first();
      await expect(menu).toBeVisible();

      // Screenshot with open kebab menu
      await page.screenshot({ path: path.join(screenshotsDir, "therapist-kebab-open.png") });

      // Dismiss with Escape
      await page.keyboard.press("Escape");
      await expect(menu).not.toBeVisible();

      // Reopen and dismiss with outside click
      await firstKebab.click();
      await expect(menu).toBeVisible();
      await page.locator("body").click({ position: { x: 10, y: 10 } });
      await expect(menu).not.toBeVisible();
    }

    // Viewport 1024px on /admin/therapists
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.screenshot({ path: path.join(screenshotsDir, "therapists-1024px.png") });

    // Viewport 768px on /admin/therapists
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: path.join(screenshotsDir, "therapists-768px.png") });

    // Viewport 390px on /admin/therapists (mobile test)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(screenshotsDir, "therapists-390px.png") });

    // 3. /admin/cases visual tests
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/cases");
    await page.locator("table, [data-testid=\"empty-state\"]").first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, "cases-1440px.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(screenshotsDir, "cases-390px.png") });

    // 4. Form responsive sticky footer on /admin/cases/new
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/cases/new");
    await page.locator("form").first().waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, "new-case-form-desktop.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(screenshotsDir, "new-case-form-mobile.png") });
  });
});
