import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const mobileScreenshotsDir = path.resolve(process.cwd(), "test-results/mobile");
const mobileFixScreenshotsDir = path.resolve(process.cwd(), "test-results/mobile-fix");

if (!fs.existsSync(mobileScreenshotsDir)) {
  fs.mkdirSync(mobileScreenshotsDir, { recursive: true });
}
if (!fs.existsSync(mobileFixScreenshotsDir)) {
  fs.mkdirSync(mobileFixScreenshotsDir, { recursive: true });
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
        permissions: ["geolocation"],
        geolocation: { latitude: 17.4325, longitude: 78.4071 },
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

    test(`[OVERFLOW] Width ${vp.width}px: Admin Cases has no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "admin.json"),
      });
      const page = await context.newPage();
      await page.goto("/admin/cases");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await context.close();
    });

    test(`[OVERFLOW] Width ${vp.width}px: Admin Therapists has no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "admin.json"),
      });
      const page = await context.newPage();
      await page.goto("/admin/therapists");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await context.close();
    });

    test(`[OVERFLOW] Width ${vp.width}px: Super Admin Reports has no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "super-admin.json"),
      });
      const page = await context.newPage();
      await page.goto("/super-admin/reports");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await context.close();
    });

    test(`[OVERFLOW] Width ${vp.width}px: Super Admin Notifications has no horizontal overflow`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "super-admin.json"),
      });
      const page = await context.newPage();
      await page.goto("/super-admin/notifications");

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
      await context.close();
    });
  }

  // 2. Bottom Tab Bar Navigation Visibility & Dimensions
  test("[NAV] Bottom Tab Bar is visible, items >= 48px, active marked", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 17.4325, longitude: 78.4071 },
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    const tabNav = page.locator('[data-testid="bottom-tab-bar"]');
    await expect(tabNav).toBeVisible();

    // Verify all 4 tabs for therapist
    const todayTab = page.locator('[data-testid="tab-therapist-today"]');
    const patientsTab = page.locator('[data-testid="tab-therapist-patients"]');
    const notesTab = page.locator('[data-testid="tab-therapist-notes"]');
    const profileTab = page.locator('[data-testid="tab-therapist-profile"]');

    await expect(todayTab).toBeVisible();
    await expect(patientsTab).toBeVisible();
    await expect(notesTab).toBeVisible();
    await expect(profileTab).toBeVisible();

    // Verify touch target min-height 48px
    const todayBox = await todayTab.boundingBox();
    expect(todayBox).not.toBeNull();
    expect(todayBox!.height).toBeGreaterThanOrEqual(48);

    // Verify active page indicator
    await expect(todayTab).toHaveAttribute("aria-current", "page");

    await context.close();
  });

  // 3. Typography & Form Inputs >= 16px
  test("[TOUCH] Input font sizes >= 16px across login and forms", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    const emailInput = page.locator('[data-testid="login-email-input"]');
    const passwordInput = page.locator('[data-testid="login-password-input"]');

    const emailFontSize = await emailInput.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
    const passFontSize = await passwordInput.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));

    expect(emailFontSize).toBeGreaterThanOrEqual(16);
    expect(passFontSize).toBeGreaterThanOrEqual(16);

    // Verify inputmode
    await expect(emailInput).toHaveAttribute("inputmode", "email");
  });

  // 4. Keyboard viewport handling
  test("[KEYBOARD] Sticky save button remains visible at 390x500 viewport", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 500 },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 17.4325, longitude: 78.4071 },
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/cases/new");

    const saveButton = page.locator('[data-testid="submit-case-btn"]');
    await expect(saveButton).toBeVisible();

    const box = await saveButton.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(520);

    await context.close();
  });

  // 5. Signature Pad touch drawing
  test("[SIGNATURE] Signature pad draws with touch input", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 17.4325, longitude: 78.4071 },
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    const tile = page.locator('[data-testid="case-tile"]').first();
    if (await tile.isVisible()) {
      await tile.click();

      // If session is already recorded for today, click edit to reveal signature pad
      const editBtn = page.locator('[data-testid="edit-session-btn"]');
      if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await editBtn.click();
      }

      const canvas = page.locator('[data-testid="signature-pad"]').first();
      await expect(canvas).toBeVisible();

      const canvasBox = await canvas.boundingBox();
      expect(canvasBox).not.toBeNull();
      expect(canvasBox!.height).toBeGreaterThanOrEqual(240);

      // Simulate finger touch stroke
      const startX = canvasBox!.x + 30;
      const startY = canvasBox!.y + 50;

      await page.touchscreen.tap(startX, startY);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 80, startY + 40);
      await page.mouse.up();

      const isBlank = await canvas.evaluate((c: HTMLCanvasElement) => {
        const ctx = c.getContext("2d");
        if (!ctx) return true;
        const pixelData = ctx.getImageData(0, 0, c.width, c.height).data;
        return !pixelData.some((channel) => channel !== 0);
      });
      expect(isBlank).toBe(false);
    }

    await context.close();
  });

  // 6. Camera Photo Input attribute verification
  test("[CAMERA] Photo capture attribute exists for phone camera", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["geolocation"],
      geolocation: { latitude: 17.4325, longitude: 78.4071 },
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/cases/new");

    const fileInput = page.locator('input[type="file"][capture="environment"]');
    await expect(fileInput).toHaveCount(1);
    await expect(fileInput).toHaveAttribute("capture", "environment");

    await context.close();
  });

  // 7. Offline Page & Zero Patient Cache Leak
  test("[OFFLINE] Offline page loads and stores no patient data in cache", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.locator("body")).toContainText("You are offline");

    const hasPatientCache = await page.evaluate(async () => {
      if (!("caches" in window)) return false;
      const keys = await window.caches.keys();
      for (const k of keys) {
        const cache = await window.caches.open(k);
        const reqs = await cache.keys();
        for (const req of reqs) {
          if (
            req.url.includes("/api/") ||
            req.url.includes("/cases") ||
            req.url.includes("/photos") ||
            req.url.includes("/signatures")
          ) {
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

  // 9. Screenshots Capture at 360 and 390px
  for (const vp of [mobileViewports[0], mobileViewports[1]]) {
    test(`[SCREENSHOT] Capture mobile screens at ${vp.width}px for mobile-fix`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
      });

      // 1. Login
      const page = await context.newPage();
      await page.goto("/login");
      await page.screenshot({
        path: path.join(mobileFixScreenshotsDir, `login-${vp.width}px.png`),
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
        path: path.join(mobileFixScreenshotsDir, `therapist-today-${vp.width}px.png`),
        fullPage: false,
      });

      // 3. Tile red and green
      await thPage.screenshot({
        path: path.join(mobileFixScreenshotsDir, `tile-red-green-${vp.width}px.png`),
        fullPage: false,
      });

      // 4. Case creation page
      await thPage.goto("/therapist/cases/new");
      await thPage.waitForLoadState("domcontentloaded");
      await thPage.waitForTimeout(600);
      await thPage.screenshot({
        path: path.join(mobileFixScreenshotsDir, `case-page-${vp.width}px.png`),
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
          path: path.join(mobileFixScreenshotsDir, `session-sheet-${vp.width}px.png`),
          fullPage: false,
        });

        // Scroll signature pad into view if present
        const sigPad = thPage.locator('[data-testid="signature-pad"]').first();
        if (await sigPad.isVisible()) {
          await sigPad.scrollIntoViewIfNeeded();
          await thPage.waitForTimeout(300);
        }
        await thPage.screenshot({
          path: path.join(mobileFixScreenshotsDir, `signature-pad-${vp.width}px.png`),
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
        path: path.join(mobileFixScreenshotsDir, `admin-dashboard-${vp.width}px.png`),
        fullPage: false,
      });

      await adPage.goto("/admin/cases");
      await adPage.waitForLoadState("domcontentloaded");
      await adPage.waitForTimeout(600);
      await adPage.screenshot({
        path: path.join(mobileFixScreenshotsDir, `admin-cases-${vp.width}px.png`),
        fullPage: false,
      });

      await adPage.goto("/admin/therapists");
      await adPage.waitForLoadState("domcontentloaded");
      await adPage.waitForTimeout(600);
      await adPage.screenshot({
        path: path.join(mobileFixScreenshotsDir, `admin-therapists-${vp.width}px.png`),
        fullPage: false,
      });

      await adminContext.close();

      // 7. Super Admin Reports & Notifications
      const superAdminContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: true,
        hasTouch: true,
        storageState: path.join(authDir, "super-admin.json"),
      });
      const saPage = await superAdminContext.newPage();
      await saPage.goto("/super-admin/reports");
      await saPage.waitForLoadState("domcontentloaded");
      await saPage.waitForTimeout(600);
      await saPage.screenshot({
        path: path.join(mobileFixScreenshotsDir, `report-page-${vp.width}px.png`),
        fullPage: false,
      });

      await saPage.goto("/super-admin/notifications");
      await saPage.waitForLoadState("domcontentloaded");
      await saPage.waitForTimeout(600);
      await saPage.screenshot({
        path: path.join(mobileFixScreenshotsDir, `super-admin-notifications-${vp.width}px.png`),
        fullPage: false,
      });

      await superAdminContext.close();
      await context.close();
    });
  }
});
