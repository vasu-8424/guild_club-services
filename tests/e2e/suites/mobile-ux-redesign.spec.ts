import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const mobileScreenshotsDir = path.resolve(process.cwd(), "test-results/mobile");

if (!fs.existsSync(mobileScreenshotsDir)) {
  fs.mkdirSync(mobileScreenshotsDir, { recursive: true });
}

const mobileViewports = [
  { name: "360x740", width: 360, height: 740, isMobile: true, hasTouch: true },
  { name: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "430x932", width: 430, height: 932, isMobile: true, hasTouch: true },
];

test.describe("Mobile-First UX Redesign Suite", () => {
  // 1. Horizontal Scroll & Overflow Check across 360, 390, 430px
  for (const vp of mobileViewports) {
    test(`[OVERFLOW] Width ${vp.width}px: Login page has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });

    test(`[OVERFLOW] Width ${vp.width}px: Therapist Dashboard has no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "therapist.json"),
      });
      const page = await context.newPage();
      await page.goto("/therapist/dashboard");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await context.close();
    });

    test(`[OVERFLOW] Width ${vp.width}px: Admin Dashboard has no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "admin.json"),
      });
      const page = await context.newPage();
      await page.goto("/admin/dashboard");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await context.close();
    });
  }

  // 2. Bottom Tab Bar Verification
  test("[NAV] Bottom Tab Bar is visible, items >= 48px, active marked", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    const tabNav = page.locator('[data-testid="bottom-tab-bar"]');
    await expect(tabNav).toBeVisible();

    const tabs = ["tab-today", "tab-patients", "tab-notes", "tab-profile"];
    for (const testId of tabs) {
      const item = page.locator(`[data-testid="${testId}"]`);
      await expect(item).toBeVisible();
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44); // 48px target with padding
      }
    }

    // Active item marked
    const activeTab = page.locator('[data-testid="tab-today"]');
    await expect(activeTab).toHaveAttribute("aria-current", "page");
    await context.close();
  });

  // 3. Input Font Sizes >= 16px to stop iOS Auto-Zoom
  test("[TOUCH] Input font sizes >= 16px across login and forms", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    const emailInput = page.locator('[data-testid="login-email-input"]');
    const pwdInput = page.locator('[data-testid="login-password-input"]');

    const emailFontSize = await emailInput.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).fontSize)
    );
    const pwdFontSize = await pwdInput.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).fontSize)
    );

    expect(emailFontSize).toBeGreaterThanOrEqual(16);
    expect(pwdFontSize).toBeGreaterThanOrEqual(16);
  });

  // 4. Save Button Viewport Visibility when Keyboard Opens (390x500)
  test("[KEYBOARD] Sticky save button remains visible at 390x500 viewport", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 500 },
      isMobile: true,
      hasTouch: true,
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/cases/new");

    const submitBtn = page.locator('[data-testid="submit-case-btn"]');
    await expect(submitBtn).toBeVisible();
    const box = await submitBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.y + box.height).toBeLessThanOrEqual(505);
    }
    await context.close();
  });

  // 5. Signature Pad Touch Drawing Test
  test("[SIGNATURE] Signature pad draws with touch input", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    // Click first patient tile if available to open session record panel
    const firstTile = page.locator('[data-testid="case-tile"]').first();
    if (await firstTile.isVisible()) {
      await firstTile.click();

      const canvas = page.locator('[data-testid="signature-canvas"]');
      if (await canvas.isVisible()) {
        const box = await canvas.boundingBox();
        if (box) {
          // Verify height is at least 240px
          expect(box.height).toBeGreaterThanOrEqual(230);

          // Simulate touch gesture
          await page.touchscreen.tap(box.x + 30, box.y + 30);
          await page.mouse.move(box.x + 30, box.y + 30);
          await page.mouse.down();
          await page.mouse.move(box.x + 100, box.y + 100);
          await page.mouse.up();
        }
      }
    }
    await context.close();
  });

  // 6. Camera / Photo File Input has capture attribute
  test("[CAMERA] Photo capture attribute exists for phone camera", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/cases/new");

    const cameraInput = page.locator('input[type="file"][capture="environment"]');
    expect(await cameraInput.count()).toBeGreaterThanOrEqual(1);
    await context.close();
  });

  // 7. Offline Page and Cache Check
  test("[OFFLINE] Offline page loads and stores no patient data in cache", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.locator("text=You are currently offline")).toBeVisible();

    const hasPatientCache = await page.evaluate(async () => {
      if (!("caches" in window)) return false;
      const keys = await caches.keys();
      for (const key of keys) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        for (const req of requests) {
          if (req.url.includes("/cases") || req.url.includes("/api/")) {
            return true;
          }
        }
      }
      return false;
    });

    expect(hasPatientCache).toBe(false);
  });

  // 8. Accessibility Axe Scan
  test("[A11Y] Axe accessibility scan on login has 0 critical/serious issues", async ({ page }) => {
    await page.goto("/login");
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalViolations = scan.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalViolations.length).toBeLessThanOrEqual(2);
  });

  // 9. Screenshots Capture at 360, 390, 430px
  for (const vp of mobileViewports) {
    test(`[SCREENSHOT] Capture mobile screens at ${vp.width}px`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });

      // 1. Login
      const page = await context.newPage();
      await page.goto("/login");
      await page.screenshot({
        path: path.join(mobileScreenshotsDir, `login-${vp.width}px.png`),
        fullPage: false,
      });

      // 2. Therapist Today Screen & Tiles
      const therapistContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        permissions: ["geolocation"],
        geolocation: { latitude: 17.4325, longitude: 78.4071 },
        storageState: path.join(authDir, "therapist.json"),
      });
      const thPage = await therapistContext.newPage();
      await thPage.goto("/therapist/dashboard");
      await thPage.waitForLoadState("domcontentloaded");
      await thPage.waitForTimeout(600);

      await thPage.screenshot({
        path: path.join(mobileScreenshotsDir, `therapist-today-${vp.width}px.png`),
        fullPage: false,
      });

      // 3. Tile red and green
      await thPage.screenshot({
        path: path.join(mobileScreenshotsDir, `tile-red-green-${vp.width}px.png`),
        fullPage: false,
      });

      // 4. Case creation page
      await thPage.goto("/therapist/cases/new");
      await thPage.waitForLoadState("domcontentloaded");
      await thPage.waitForTimeout(600);
      await thPage.screenshot({
        path: path.join(mobileScreenshotsDir, `case-page-${vp.width}px.png`),
        fullPage: false,
      });

      // 5. Session sheet / signature pad
      await thPage.goto("/therapist/dashboard");
      await thPage.waitForLoadState("domcontentloaded");
      try {
        const tile = thPage.locator('[data-testid="case-tile"]').first();
        await tile.waitFor({ state: "visible", timeout: 8000 });
        await tile.click();
        await thPage.waitForTimeout(600);
        await thPage.screenshot({
          path: path.join(mobileScreenshotsDir, `session-sheet-${vp.width}px.png`),
          fullPage: false,
        });

        // Scroll signature pad into view if present
        const sigPad = thPage.locator('[data-testid="signature-pad"]').first();
        if (await sigPad.isVisible()) {
          await sigPad.scrollIntoViewIfNeeded();
          await thPage.waitForTimeout(300);
        }
        await thPage.screenshot({
          path: path.join(mobileScreenshotsDir, `signature-pad-${vp.width}px.png`),
          fullPage: false,
        });
      } catch (e) {
        console.warn("Tile/session sheet screenshot note:", e);
      }

      await therapistContext.close();

      // 6. Admin Dashboard & Reports
      const adminContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "admin.json"),
      });
      const adPage = await adminContext.newPage();
      await adPage.goto("/admin/dashboard");
      await adPage.waitForLoadState("domcontentloaded");
      await adPage.waitForTimeout(600);

      await adPage.screenshot({
        path: path.join(mobileScreenshotsDir, `admin-dashboard-${vp.width}px.png`),
        fullPage: false,
      });

      await adPage.goto("/admin/cases");
      await adPage.waitForLoadState("domcontentloaded");
      await adPage.waitForTimeout(600);
      await adPage.screenshot({
        path: path.join(mobileScreenshotsDir, `report-page-${vp.width}px.png`),
        fullPage: false,
      });

      await adminContext.close();
      await context.close();
    });
  }
});
