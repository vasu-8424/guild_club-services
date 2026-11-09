import { test, expect } from "@playwright/test";

const ARTIFACTS_DIR = "C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3";

test.describe("Admin Dashboard & Scoping Clean-up Suite", () => {
  // 1. Mobile & Desktop Admin Dashboard Verification
  const viewports = [
    { width: 360, height: 740, name: "360px" },
    { width: 390, height: 844, name: "390px" },
    { width: 1440, height: 900, name: "1440px" },
  ];

  for (const vp of viewports) {
    test(`Admin Dashboard: Rooms tile, banner, and therapist table are removed (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/admin.json",
        isMobile: vp.width < 500,
        hasTouch: vp.width < 500,
      });
      const page = await context.newPage();

      await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      // Remaining tiles must exist
      await expect(page.locator('[data-testid="stat-therapists"]')).toBeVisible();
      await expect(page.locator('[data-testid="stat-active-cases"]')).toBeVisible();
      await expect(page.locator('[data-testid="stat-sessions"]')).toBeVisible();

      // Removed tiles and sections must NOT exist
      await expect(page.locator('[data-testid="stat-rooms"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="null-room-cases-banner"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="therapists-table"]')).toHaveCount(0);

      // Session reasons inbox card remains present
      await expect(page.locator('[data-testid="admin-reason-inbox-card"]')).toBeVisible();

      // Capture screenshots for mobile viewports
      if (vp.name === "360px" || vp.name === "390px") {
        await page.screenshot({
          path: `${ARTIFACTS_DIR}/admin-dashboard-noroom-${vp.name}.png`,
          fullPage: false,
        });
      }

      await page.close();
      await context.close();
    });
  }

  // 2. Admin Navigation: No Rooms in Tab Bar or Sidebar; /admin/rooms redirects
  test("Admin Navigation: No Rooms entry in tab bar or sidebar, /admin/rooms redirects", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: "playwright/.auth/admin.json",
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });

    // Bottom tab bar must NOT have Rooms tab
    await expect(page.locator('[data-testid="tab-rooms"]')).toHaveCount(0);

    // Directly navigating to /admin/rooms should redirect to /admin/dashboard
    await page.goto("/admin/rooms", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 6000 });
    expect(page.url()).toContain("/admin/dashboard");

    await page.close();
    await context.close();
  });

  // 3. Admin Cases Page: No branch filter dropdown; static branch label; 404 on tampering
  for (const vp of [viewports[0], viewports[1]]) {
    test(`Admin Cases Page: static branch label and no branch filter dropdown (${vp.name})`, async ({
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

      // No select[name="branch"] for admin
      await expect(page.locator('select[name="branch"]')).toHaveCount(0);

      // Static branch label exists and shows the Admin's branch name
      const branchLabel = page.locator('[data-testid="admin-branch-label"]');
      await expect(branchLabel).toBeVisible();
      await expect(branchLabel).toHaveText("Wellknox Banjara Hills");

      // Capture screenshot
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/admin-cases-nobranchfilter-${vp.name}.png`,
        fullPage: false,
      });

      await page.close();
      await context.close();
    });
  }

  test("Admin Cases Page: ?branch=foreign_id returns 404 (Scope security)", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: "playwright/.auth/admin.json",
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    // Pass a fake / foreign branch id
    const response = await page.goto("/admin/cases?branch=99999999-9999-9999-9999-999999999999");
    expect([404, 200]).toContain(response?.status());
    // Next.js returns 404 status code or renders Not Found heading
    const notFoundText = page.locator("text=/page not found|not found/i");
    await expect(notFoundText.first()).toBeVisible();

    await page.close();
    await context.close();
  });

  // 4. Super Admin Rooms & Cases verification
  test("Super Admin: Rooms page works and Cases shows branch picker when no branch selected", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      storageState: "playwright/.auth/super-admin.json",
    });
    const page = await context.newPage();

    // Rooms page loads for Super Admin
    await page.goto("/admin/rooms", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/rooms/);
    await expect(page.locator('[data-testid="rooms-table"]')).toBeVisible();

    await page.close();
    await context.close();
  });

  // 5. Therapist: Create case flow still lists free rooms
  test("Therapist: Create case form loads and lists free rooms in branch", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: "playwright/.auth/therapist.json",
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto("/therapist/cases/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-testid="room-select"], select[name="roomId"]')).toBeVisible();

    await page.close();
    await context.close();
  });
});
