import { test, expect } from "@playwright/test";
import path from "path";
import AxeBuilder from "@axe-core/playwright";
import { getTodayIST, getDaysAgoIST } from "../../src/lib/date-utils";

const authDir = path.resolve(process.cwd(), "playwright/.auth");

test.describe("Stage 4: Sharp Visual Dashboards & Chart Components", () => {
  test("CHART-01: Super Admin Command Center renders all visual charts with seeded data", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/super-admin/dashboard");
    await page.waitForLoadState("networkidle");

    // 1. Verify Top SparkStatCards
    await expect(page.getByTestId("kpi-card-cases-created")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("kpi-card-active-cases")).toBeVisible();
    await expect(page.getByTestId("kpi-card-sessions-held")).toBeVisible();
    await expect(page.getByTestId("kpi-card-active-therapists")).toBeVisible();

    // 2. Verify Row 2: RadialGauge & AreaTrendChart
    await expect(page.locator('section[aria-label*="Overall Success Rate"]')).toBeVisible();
    await expect(page.locator('section[aria-label*="Cases Created vs Completed"]')).toBeVisible();

    // 3. Verify Row 3: FunnelChart & DonutChart
    await expect(page.locator('section[aria-label*="Case Pipeline"]')).toBeVisible();
    await expect(page.locator('section[aria-label*="Cases by"]')).toBeVisible();

    // 4. Verify Row 4: StackedBarChart & Top Therapists Leaderboard
    await expect(page.locator('section[aria-label*="Workload by Therapist"]')).toBeVisible();
    await expect(page.locator('section[aria-label*="Top Therapists by Success Rate"]')).toBeVisible();

    // 5. Verify Row 5: ActivityHeatmap & Admin Productivity
    await expect(page.locator('section[aria-label*="Daily Clinical Activity"]')).toBeVisible();
    await expect(page.locator('section[aria-label*="Admin Productivity"]')).toBeVisible();

    // 6. Verify Row 6: Team Activity DataTable
    await expect(page.locator("body")).toContainText("Team Activity & Governance Roster");

    await context.close();
  });

  test("CHART-02: Admin Operations Dashboard renders operational charts and attention panel", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/admin/dashboard");
    await page.waitForLoadState("networkidle");

    // 1. Row 1 SparkStatCards
    await expect(page.getByTestId("kpi-card-unassigned-cases")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("kpi-card-in-progress")).toBeVisible();
    await expect(page.getByTestId("kpi-card-completed-period")).toBeVisible();
    await expect(page.getByTestId("kpi-card-available-therapists")).toBeVisible();

    // 2. Row 2: StackedBarChart & DonutChart
    await expect(page.locator('section[aria-label*="Cases by Priority and Status"]')).toBeVisible();
    await expect(page.locator('section[aria-label*="Cases by Category"]')).toBeVisible();

    // 3. Row 3: ProgressList & AreaTrendChart
    await expect(page.locator('section[aria-label*="Therapist Workload (Open Cases / Capacity)"]')).toBeVisible();
    await expect(page.locator('section[aria-label*="New Cases per Day"]')).toBeVisible();

    // 4. Row 4: FunnelChart & Needs Attention Panel
    await expect(page.locator('section[aria-label*="My Assignment Pipeline"]')).toBeVisible();
    await expect(page.locator("body")).toContainText(/Needs Attention/i);

    // 5. Row 5: Cases Waiting for Assignment Table
    await expect(page.locator("body")).toContainText("Cases Waiting for Assignment");

    await context.close();
  });

  test("CHART-03: Empty date shows elegant empty states and read-only history banner", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();
    const pastEmptyDate = getDaysAgoIST(120);

    await page.goto(`/super-admin/dashboard?date=${pastEmptyDate}`);
    await page.waitForLoadState("networkidle");

    // History and No Activity Banners
    await expect(page.getByTestId("history-banner")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("no-activity-banner")).toBeVisible();

    // Charts render structured empty states without blank white boxes
    await expect(page.locator("body")).toContainText("No trend records found");

    await context.close();
  });

  test("CHART-04: Clicking a heatmap day cell navigates to that date", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();
    await page.goto("/super-admin/dashboard");
    await page.waitForLoadState("networkidle");

    // Locate the heatmap container
    const heatmapSection = page.locator('section[aria-label*="Daily Clinical Activity"]');
    await expect(heatmapSection).toBeVisible({ timeout: 10000 });

    // Click on a day button within the heatmap
    const dayCells = heatmapSection.locator('button[aria-label*="events"]');
    const firstCell = dayCells.first();
    await expect(firstCell).toBeVisible();

    // Click the cell
    await firstCell.click();

    // Verify URL updates with ?date=
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/, { timeout: 10000 });

    await context.close();
  });

  test("CHART-05: Strict role enforcement prevents unauthorized access to admin/super-admin dashboards", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();

    // Therapist trying to access Super Admin dashboard -> redirected
    await page.goto("/super-admin/dashboard");
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    // Therapist trying to access Admin dashboard -> redirected
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    await context.close();
  });

  test("CHART-06: Axe Accessibility Check on Super Admin and Admin dashboards", async ({ browser }) => {
    // 1. Super Admin Dashboard Axe check
    const saContext = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
      viewport: { width: 1440, height: 900 },
    });
    const saPage = await saContext.newPage();
    await saPage.goto("/super-admin/dashboard");
    await saPage.waitForLoadState("networkidle");

    const saResults = await new AxeBuilder({ page: saPage })
      .disableRules(["color-contrast"]) // chart gradients are reviewed visually
      .analyze();
    
    // Ensure zero critical or serious accessibility violations
    const saCriticalViolations = saResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(saCriticalViolations, `Critical violations on Super Admin: ${JSON.stringify(saCriticalViolations, null, 2)}`).toHaveLength(0);
    await saContext.close();

    // 2. Admin Dashboard Axe check
    const adminContext = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
      viewport: { width: 1440, height: 900 },
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/dashboard");
    await adminPage.waitForLoadState("networkidle");

    const adminResults = await new AxeBuilder({ page: adminPage })
      .disableRules(["color-contrast"])
      .analyze();

    const adminCriticalViolations = adminResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(adminCriticalViolations, `Critical violations on Admin: ${JSON.stringify(adminCriticalViolations, null, 2)}`).toHaveLength(0);
    await adminContext.close();
  });
});
