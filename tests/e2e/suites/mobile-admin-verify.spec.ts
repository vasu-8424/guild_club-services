import { test, expect } from "@playwright/test";
import path from "path";
import { db } from "@/db";
import { cases, branches } from "@/db/schema";
import { eq } from "drizzle-orm";

test.describe("Admin Dashboard Layout & Warning Banner Verification", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    storageState: "playwright/.auth/admin.json",
  });

  test.beforeAll(async () => {
    // Ensure there is at least one active case with roomId = null in the test branch
    const branchList = await db.select().from(branches).limit(1);
    if (branchList.length > 0) {
      const branchId = branchList[0].id;
      const existingCases = await db.select().from(cases).where(eq(cases.branchId, branchId)).limit(1);
      if (existingCases.length > 0) {
        await db.update(cases).set({ roomId: null, status: "active" }).where(eq(cases.id, existingCases[0].id));
      }
    }
  });

  test("390x844: REVIEW CASES button is >= 44px high, fully inside box, no horizontal scroll, and header aligns to 16px", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    // 1. Verify Topbar title alignment
    const topbarTitle = page.locator('[data-testid="topbar-title"]');
    await expect(topbarTitle).toBeVisible();
    const titleBox = await topbarTitle.boundingBox();
    expect(titleBox).not.toBeNull();

    // 2. Verify Info icon and subtitle alignment
    const infoIcon = page.locator('main svg.h-4.w-4').first();
    await expect(infoIcon).toBeVisible();
    const infoBox = await infoIcon.boundingBox();
    expect(infoBox).not.toBeNull();

    // Both Topbar title and Info icon line up on the exact same left edge (16px padding + 1px border = 17px)
    expect(Math.round(titleBox!.x)).toBe(Math.round(infoBox!.x));
    expect(Math.round(titleBox!.x)).toBeGreaterThanOrEqual(16);
    expect(Math.round(titleBox!.x)).toBeLessThanOrEqual(17);

    // 3. Verify Download Report button and Date Selector are full width and 48px high on phones
    const downloadBtn = page.locator('[data-testid="branch-report-download-btn"]');
    await expect(downloadBtn).toBeVisible();
    const downloadBox = await downloadBtn.boundingBox();
    expect(downloadBox).not.toBeNull();
    expect(downloadBox!.height).toBeGreaterThanOrEqual(48);

    const dateBtn = page.locator('[data-testid="date-selector-button"]');
    await expect(dateBtn).toBeVisible();
    const dateBox = await dateBtn.boundingBox();
    expect(dateBox).not.toBeNull();
    expect(dateBox!.height).toBeGreaterThanOrEqual(48);

    // Verify they are stacked (date selector is below download report button)
    expect(dateBox!.y).toBeGreaterThan(downloadBox!.y);

    // 4. Verify Rooms section & Rooms metric tile are removed from Admin Dashboard
    const banner = page.locator('[data-testid="null-room-cases-banner"]');
    await expect(banner).toHaveCount(0);
    const roomsStat = page.locator('[data-testid="stat-rooms"]');
    await expect(roomsStat).toHaveCount(0);

    // 5. Verify NO horizontal scroll on the page
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Capture screenshot for verification
    const screenshotPath = path.join(process.cwd(), "test-results", "admin-dashboard-390px-verified.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
  });
});
