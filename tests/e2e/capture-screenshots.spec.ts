import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const screenshotDir = path.resolve(process.cwd(), "test-results/screenshots-ui");

// Ensure directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

test.describe("UI Screenshot Capture Suite", () => {
  // 1. Login Page (Unauthenticated)
  for (const vp of VIEWPORTS) {
    test(`Capture Login page - ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(screenshotDir, `login-${vp.name}.png`),
        fullPage: true,
      });
    });
  }

  // 2. Super Admin Pages
  for (const vp of VIEWPORTS) {
    test(`Capture Super Admin pages - ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: path.join(authDir, "super-admin.json"),
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      // Dashboard
      await page.goto("/super-admin/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(screenshotDir, `super-admin-dashboard-${vp.name}.png`),
        fullPage: true,
      });

      // Admins List
      await page.goto("/super-admin/admins");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(screenshotDir, `super-admin-admins-${vp.name}.png`),
        fullPage: true,
      });

      // Add Admin Form
      await page.goto("/super-admin/admins/new");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(screenshotDir, `super-admin-add-admin-${vp.name}.png`),
        fullPage: true,
      });

      // Reports
      await page.goto("/super-admin/reports");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
      await page.screenshot({
        path: path.join(screenshotDir, `super-admin-reports-${vp.name}.png`),
        fullPage: true,
      });

      await context.close();
    });
  }

  // 3. Admin Pages
  for (const vp of VIEWPORTS) {
    test(`Capture Admin pages - ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: path.join(authDir, "admin.json"),
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      // Dashboard
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(screenshotDir, `admin-dashboard-${vp.name}.png`),
        fullPage: true,
      });

      // Cases List
      await page.goto("/admin/cases");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(screenshotDir, `admin-cases-${vp.name}.png`),
        fullPage: true,
      });

      // New Case Form
      await page.goto("/admin/cases/new");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(screenshotDir, `admin-new-case-${vp.name}.png`),
        fullPage: true,
      });

      // Therapists Directory
      await page.goto("/admin/therapists");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(screenshotDir, `admin-therapists-${vp.name}.png`),
        fullPage: true,
      });

      // Register Therapist Form
      await page.goto("/admin/therapists/new");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(screenshotDir, `admin-new-therapist-${vp.name}.png`),
        fullPage: true,
      });

      await context.close();
    });
  }

  // 4. Therapist Pages
  for (const vp of VIEWPORTS) {
    test(`Capture Therapist pages - ${vp.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        storageState: path.join(authDir, "therapist.json"),
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      // Dashboard
      await page.goto("/therapist/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(screenshotDir, `therapist-dashboard-${vp.name}.png`),
        fullPage: true,
      });

      await context.close();
    });
  }
});
