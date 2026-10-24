import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "path";
import fs from "fs";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const screenshotsDir = path.resolve(process.cwd(), "test-results/screenshots");

test.describe("E. Base Layout & UI", () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test("UI-01: Each role's dashboard shows the user's name and role", async ({ browser }) => {
    const roles = [
      { role: "super-admin", name: "Test Super Admin", roleText: "super_admin", file: "super-admin.json", path: "/super-admin/dashboard" },
      { role: "admin", name: "Test Admin", roleText: "admin", file: "admin.json", path: "/admin/dashboard" },
      { role: "therapist", name: "Dr. Test Therapist Active", roleText: "therapist", file: "therapist.json", path: "/therapist/dashboard" },
    ];

    for (const r of roles) {
      const context = await browser.newContext({
        storageState: path.join(authDir, r.file),
      });
      const page = await context.newPage();
      await page.goto(r.path);

      await expect(page.locator('[data-testid="user-name-heading"]')).toContainText(r.name);
      await expect(page.locator('[data-testid="user-role-badge"]')).toContainText(r.roleText);

      await context.close();
    }
  });

  test("UI-02: Top bar, sidebar, profile menu, logout button, and date-picker placeholder are visible", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/super-admin/dashboard");

    // 1. Top bar
    await expect(page.locator('[data-testid="topbar"]')).toBeVisible();

    // 2. Sidebar
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

    // 3. Date picker placeholder
    await expect(page.locator('[data-testid="date-picker-placeholder"]')).toBeVisible();

    // 4. Profile user menu
    const userMenuBtn = page.locator('[data-testid="user-menu-button"]');
    await expect(userMenuBtn).toBeVisible();
    await userMenuBtn.click();

    // 5. Dropdown menu & Logout button
    await expect(page.locator('[data-testid="user-menu-dropdown"]')).toBeVisible();
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();

    await context.close();
  });

  test("UI-03: Responsive check at mobile (390x844), tablet (768x1024), and desktop (1440x900) without horizontal overflow", async ({ browser }) => {
    test.setTimeout(90000);
    const viewports = [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 900 },
    ];

    const roles = [
      { role: "super-admin", file: "super-admin.json", path: "/super-admin/dashboard" },
      { role: "admin", file: "admin.json", path: "/admin/dashboard" },
      { role: "therapist", file: "therapist.json", path: "/therapist/dashboard" },
    ];

    for (const r of roles) {
      for (const vp of viewports) {
        const context = await browser.newContext({
          storageState: path.join(authDir, r.file),
          viewport: { width: vp.width, height: vp.height },
        });
        const page = await context.newPage();
        await page.goto(r.path);
        await page.waitForLoadState("networkidle");

        // Verify layout does not overflow horizontally
        const hasHorizontalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        expect(hasHorizontalOverflow, `Horizontal overflow detected for ${r.role} at ${vp.name}`).toBe(false);

        // Capture screenshot
        const screenshotPath = path.join(screenshotsDir, `${r.role}-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        await context.close();
      }
    }
  });

  test("UI-04: Basic accessibility with @axe-core/playwright on login and dashboard pages", async ({ browser }) => {
    // 1. Check Login page
    const loginContext = await browser.newContext();
    const loginPage = await loginContext.newPage();
    await loginPage.goto("/login");

    const loginAxeResults = await new AxeBuilder({ page: loginPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const loginViolations = loginAxeResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(loginViolations, `Serious/Critical a11y violations found on /login: ${JSON.stringify(loginViolations, null, 2)}`).toHaveLength(0);
    await loginContext.close();

    // 2. Check Dashboard page
    const dashboardContext = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const dashboardPage = await dashboardContext.newPage();
    await dashboardPage.goto("/super-admin/dashboard");

    const dashboardAxeResults = await new AxeBuilder({ page: dashboardPage })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const dashboardViolations = dashboardAxeResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(dashboardViolations, `Serious/Critical a11y violations found on /super-admin/dashboard: ${JSON.stringify(dashboardViolations, null, 2)}`).toHaveLength(0);
    await dashboardContext.close();
  });

  test("UI-05: Capture full-page visual baseline screenshots", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // Login baseline
    await page.goto("/login");
    await page.screenshot({
      path: path.join(screenshotsDir, "login-baseline-desktop.png"),
      fullPage: true,
    });

    await context.close();
  });
});
