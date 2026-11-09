import { test, expect } from "@playwright/test";
import path from "path";
import { getTodayIST, getDaysAgoIST } from "../../../src/lib/date-utils";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const ARTIFACTS_DIR = "C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3";

const viewports = [
  { name: "360px", width: 360, height: 740 },
  { name: "390px", width: 390, height: 844 },
  { name: "1440px", width: 1440, height: 900 },
];

test.describe("Super Admin Simplified Portal Suite", () => {
  // 1. Branch Picker on Initial Visit (No Branch Selected)
  test("Super Admin: Dashboard and Reports show branch picker when no branch selected", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();

    // Dashboard shows Branch Picker
    await page.goto("/super-admin/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="branch-picker-card"]')).toBeVisible();

    // Reports shows Branch Picker
    await page.goto("/super-admin/reports", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="branch-picker-card"]')).toBeVisible();

    await page.close();
    await context.close();
  });

  // 2. Super Admin Dashboard (Basic Layout across Viewports)
  for (const vp of viewports) {
    test(`Super Admin Dashboard: basic layout with date picker & closed cases only (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: path.join(authDir, "super-admin.json"),
        isMobile: vp.width < 1000,
        hasTouch: vp.width < 1000,
      });
      const page = await context.newPage();

      // Open dashboard and pick first branch
      await page.goto("/super-admin/dashboard", { waitUntil: "domcontentloaded" });
      const firstBranchBtn = page.locator('[data-testid^="select-branch-btn-"]').first();
      if (await firstBranchBtn.isVisible()) {
        await firstBranchBtn.click();
        await page.waitForLoadState("domcontentloaded");
      }

      // 1. Single Date Picker at the top
      const datePicker = page.locator('[data-testid="super-admin-date-picker"]');
      await expect(datePicker).toBeVisible();
      const todayIST = getTodayIST();
      await expect(datePicker).toHaveValue(todayIST);

      // 2. Recently Closed Cases Section
      const closedCard = page.locator('[data-testid="recently-closed-cases-card"]');
      await expect(closedCard).toBeVisible();

      // 3. Verify ALL charts, metric tiles, and tables are REMOVED
      await expect(page.locator("canvas, svg.recharts-surface, .recharts-responsive-container")).toHaveCount(0);
      await expect(page.locator('[data-testid="therapists-table"]')).toHaveCount(0);
      await expect(page.locator('[data-testid^="stat-"], [data-testid^="kpi-card-"]')).toHaveCount(0);

      // 4. Verify 7-day, 30-day, etc. range buttons DO NOT exist
      await expect(page.locator('button:has-text("7D"), button:has-text("30D"), button:has-text("90D"), button:has-text("12W")')).toHaveCount(0);

      // Capture screenshots for mobile viewports
      if (vp.width < 1000) {
        await page.screenshot({
          path: `${ARTIFACTS_DIR}/superadmin-dashboard-simplified-${vp.name}.png`,
          fullPage: false,
        });
      }

      await page.close();
      await context.close();
    });
  }

  // 3. Date Selection & History Navigation
  test("Super Admin Dashboard: Selecting a past date updates URL, shows history banner, and displays empty message when no closures", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "super-admin.json"),
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto("/super-admin/dashboard", { waitUntil: "domcontentloaded" });
    const firstBranchBtn = page.locator('[data-testid^="select-branch-btn-"]').first();
    if (await firstBranchBtn.isVisible()) {
      await firstBranchBtn.click();
      await page.waitForLoadState("domcontentloaded");
    }

    // Select a past date with no closed cases (e.g. 100 days ago)
    const emptyDate = getDaysAgoIST(100);
    const datePicker = page.locator('[data-testid="super-admin-date-picker"]');
    await datePicker.fill(emptyDate);

    // Verify URL contains the chosen date (?date=YYYY-MM-DD)
    await expect(page).toHaveURL(new RegExp(`date=${emptyDate}`), { timeout: 10000 });

    // Verify "Viewing history (read-only)" banner is displayed
    const historyBanner = page.locator('[data-testid="history-banner"]');
    await expect(historyBanner).toBeVisible();
    await expect(historyBanner).toContainText(/viewing history \(read-only\)/i);

    // Verify empty state message: "No cases were closed on this date"
    const emptyMsg = page.locator('[data-testid="no-closed-cases-message"]');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toContainText("No cases were closed on this date");

    await page.close();
    await context.close();
  });

  // 4. Reports Page: Simple Export (360px, 390px, 1440px)
  for (const vp of viewports) {
    test(`Super Admin Reports Page: simple export layout without charts (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: path.join(authDir, "super-admin.json"),
        isMobile: vp.width < 1000,
        hasTouch: vp.width < 1000,
      });
      const page = await context.newPage();

      // Go to reports and pick branch if prompted
      await page.goto("/super-admin/reports", { waitUntil: "domcontentloaded" });
      const firstBranchBtn = page.locator('[data-testid^="select-branch-btn-"]').first();
      if (await firstBranchBtn.isVisible()) {
        await firstBranchBtn.click();
        await page.waitForLoadState("domcontentloaded");
      }

      // 1. Plain page title "Reports" and one line of help text
      const title = page.locator('[data-testid="reports-title"]');
      await expect(title).toBeVisible();
      await expect(title).toHaveText("Reports");

      const helpText = page.locator('[data-testid="reports-help-text"]');
      await expect(helpText).toBeVisible();

      // 2. Verify NO visual charts exist on the page
      await expect(page.locator("canvas, svg.recharts-surface, .recharts-responsive-container")).toHaveCount(0);

      // 3. Export Excel & Export PDF buttons are present
      const excelBtn = page.locator('[data-testid="export-excel-button"]');
      const pdfBtn = page.locator('[data-testid="export-pdf-button"]');
      await expect(excelBtn).toBeVisible();
      await expect(pdfBtn).toBeVisible();

      // 4. Native From and To date fields exist and default to today's date
      const fromInput = page.locator('[data-testid="report-from-date"]');
      const toInput = page.locator('[data-testid="report-to-date"]');
      await expect(fromInput).toBeVisible();
      await expect(toInput).toBeVisible();

      const todayIST = getTodayIST();
      await expect(fromInput).toHaveValue(todayIST);
      await expect(toInput).toHaveValue(todayIST);

      // 5. Test Export buttons work without crash
      await excelBtn.click();
      await page.waitForTimeout(300);
      await pdfBtn.click();
      await page.waitForTimeout(300);

      // Capture screenshots for mobile viewports
      if (vp.width < 1000) {
        await page.screenshot({
          path: `${ARTIFACTS_DIR}/superadmin-reports-simplified-${vp.name}.png`,
          fullPage: false,
        });
      }

      await page.close();
      await context.close();
    });
  }

  // 5. Admin and Therapist dashboards remain intact
  test("Admin and Therapist dashboards remain intact", async ({ browser }) => {
    // Admin dashboard
    const adminCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "admin.json"),
      isMobile: true,
      hasTouch: true,
    });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/);
    await adminPage.close();
    await adminCtx.close();

    // Therapist dashboard
    const therapistCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "therapist.json"),
      isMobile: true,
      hasTouch: true,
    });
    const therapistPage = await therapistCtx.newPage();
    await therapistPage.goto("/therapist/dashboard", { waitUntil: "domcontentloaded" });
    await expect(therapistPage).toHaveURL(/\/therapist\/dashboard/);
    await therapistPage.close();
    await therapistCtx.close();
  });
});

