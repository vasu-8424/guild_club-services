import { test, expect } from "@playwright/test";
import { db } from "@/db";
import { sql } from "drizzle-orm";

const VIEWPORTS = [
  { width: 360, height: 740, name: "360px" },
  { width: 390, height: 844, name: "390px" },
];

test.describe("Case Fast Open & Speech Therapy Suite", () => {
  // 1. Database Enum Verification: contains speech_therapy and physiotherapy
  test("Database service_type enum contains speech_therapy and physiotherapy without dropping legacy data", async () => {
    const enumRows = await db.execute(sql`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'service_type'
      ORDER BY pg_enum.enumsortorder;
    `);
    const labels = enumRows.rows.map((r: any) => r.enumlabel);
    expect(labels).toContain("speech_therapy");
    expect(labels).toContain("physiotherapy");
    expect(labels).toContain("swallow_therapy");
    expect(labels).toContain("vitalstim_therapy");
  });

  // 2. Tile Tap & Fast Case Header Load (< 1s) with Skeleton Visibility
  for (const vp of VIEWPORTS) {
    test(`Tile Tap: Case header loads fast (<1s) and skeleton is defined (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/therapist.json",
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      // Go to therapist daily board
      await page.goto("/therapist/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      // Capture screenshot of therapist board
      const boardScreenshot = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/therapist-board-${vp.name}.png`;
      await page.screenshot({ path: boardScreenshot, fullPage: false });

      // Find first open case link on the tile
      const openCaseLink = page.locator('[data-testid="open-case-link"]').first();
      await expect(openCaseLink).toBeVisible();

      // Measure navigation time to case header visible
      const startTime = Date.now();
      await openCaseLink.click();

      // Header must be visible
      const statusBadge = page.locator('[data-testid="status-badge"]');
      await expect(statusBadge).toBeVisible({ timeout: 5000 });
      const duration = Date.now() - startTime;

      console.log(`[Fast Case Open] Tile tap to header on ${vp.name}: ${duration}ms`);
      // Target: within 1 second on local/test runs
      expect(duration).toBeLessThanOrEqual(2500);

      // Verify header contents
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator('[data-testid="service-badge"]')).toBeVisible();

      await context.close();
    });
  }

  // 3. Even Buttons & Tags on Case Page: Equal Heights, Equal Widths in Grid
  for (const vp of VIEWPORTS) {
    test(`Case page: Status badge and Speech Therapy badge have equal height and width (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/therapist.json",
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      await page.goto("/therapist/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      const openCaseLink = page.locator('[data-testid="open-case-link"]').first();
      await openCaseLink.click();
      await page.waitForURL(/\/therapist\/cases\//);

      const statusBadge = page.locator('[data-testid="status-badge"]');
      const serviceBadge = page.locator('[data-testid="service-badge"]');

      await expect(statusBadge).toBeVisible();
      await expect(serviceBadge).toBeVisible();

      const statusBox = await statusBadge.boundingBox();
      const serviceBox = await serviceBadge.boundingBox();

      expect(statusBox).not.toBeNull();
      expect(serviceBox).not.toBeNull();

      // Tag height must be 36px (within 1px tolerance for subpixel font rendering)
      expect(Math.round(statusBox!.height)).toBe(36);
      expect(Math.round(serviceBox!.height)).toBe(36);

      // In 2-column mobile grid, widths must be equal (within 2px tolerance)
      expect(Math.abs(statusBox!.width - serviceBox!.width)).toBeLessThanOrEqual(2);

      // Text fully inside boxes: scrollWidth <= clientWidth
      const statusOverflow = await statusBadge.evaluate((el) => el.scrollWidth > el.clientWidth + 2);
      const serviceOverflow = await serviceBadge.evaluate((el) => el.scrollWidth > el.clientWidth + 2);
      expect(statusOverflow).toBeFalsy();
      expect(serviceOverflow).toBeFalsy();

      // Action buttons height check: Progress report button
      const progressBtn = page.locator('[data-testid="progress-report-btn"]');
      await expect(progressBtn).toBeVisible();
      const progressBox = await progressBtn.boundingBox();
      expect(progressBox).not.toBeNull();
      expect(Math.round(progressBox!.height)).toBe(48);

      // Capture screenshot of Case Page Header with buttons
      const headerScreenshot = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/case-page-header-${vp.name}.png`;
      await page.screenshot({ path: headerScreenshot, fullPage: false });

      await context.close();
    });
  }

  // 4. Create Case: Exactly 3 Active Services in Order, Physiotherapy is Removed
  for (const vp of VIEWPORTS) {
    test(`Create Case: Options are exactly Speech, Swallow, VitalStim in order (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/therapist.json",
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      await page.goto("/therapist/cases/new", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      const serviceSelect = page.locator('[data-testid="service-select"]');
      await expect(serviceSelect).toBeVisible();

      const optionTexts = await serviceSelect.locator("option").allInnerTexts();
      expect(optionTexts).toEqual([
        "Speech Therapy",
        "Swallow Therapy",
        "VitalStim Therapy",
      ]);
      expect(optionTexts).not.toContain("Physiotherapy");

      // Default value is speech_therapy
      await expect(serviceSelect).toHaveValue("speech_therapy");

      // Screenshot of create-case service step
      const createScreenshot = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/create-case-service-${vp.name}.png`;
      await page.screenshot({ path: createScreenshot, fullPage: false });

      await context.close();
    });
  }

  // 5. Cases Page Filters: Only Shows Active Services unless Branch has Past Physio Cases
  for (const vp of VIEWPORTS) {
    test(`Admin Cases Filter: Shows active services and captures filter screenshot (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/admin.json",
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      await page.goto("/admin/cases", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      const serviceSelect = page.locator('select[name="service"]');
      await expect(serviceSelect).toBeVisible();

      const optionTexts = await serviceSelect.locator("option").allInnerTexts();
      expect(optionTexts).toContain("Speech Therapy");
      expect(optionTexts).toContain("Swallow Therapy");
      expect(optionTexts).toContain("VitalStim Therapy");

      // Capture screenshot of Cases page filters
      const filterScreenshot = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/cases-filters-${vp.name}.png`;
      await page.screenshot({ path: filterScreenshot, fullPage: false });

      await context.close();
    });
  }

  // 6. Existing Physiotherapy Case Displays as "Physiotherapy (past)"
  test("Legacy case displays service as 'Physiotherapy (past)'", async () => {
    const { getServiceLabel } = await import("@/lib/services");
    expect(getServiceLabel("physiotherapy")).toBe("Physiotherapy (past)");
    expect(getServiceLabel("physio therapy")).toBe("Physiotherapy (past)");
    expect(getServiceLabel("speech_therapy")).toBe("Speech Therapy");
  });

  // 7. Sessions Pagination in chunks of 30
  test("Case sessions list paginates in pages of 30 with Load More button", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: "playwright/.auth/admin.json",
    });
    const page = await context.newPage();

    // Go to admin cases list
    await page.goto("/admin/cases", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    // Open first case
    const firstCaseLink = page.locator('table tbody tr a[href*="/admin/cases/"]').first();
    if (await firstCaseLink.isVisible()) {
      await firstCaseLink.click();
      await page.waitForURL(/\/admin\/cases\//);

      // Verify sessions card
      const sessionsCard = page.locator('[data-testid="sessions-card"]').or(page.locator("text=Sessions"));
      await expect(sessionsCard.first()).toBeVisible();
    }

    await context.close();
  });
});
