import { test, expect } from "@playwright/test";
import path from "path";

const VIEWPORTS = [
  { width: 360, height: 740, name: "360x740" },
  { width: 390, height: 844, name: "390x844" },
];

test.describe("Mobile Phone Fixes - Navigation, Profile, Branches & Sign Out", () => {
  // 1. Therapist Profile & Sign Out Visibility
  for (const vp of VIEWPORTS) {
    test(`Therapist reaches Profile from tab bar and Sign Out is visible without scroll (${vp.name})`, async ({
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
      await page.waitForTimeout(500);

      // Verify bottom tab bar has profile
      const profileTab = page.locator('[data-testid="tab-therapist-profile"]');
      await expect(profileTab).toBeVisible();
      await profileTab.click();

      // Should be on profile page
      await expect(page).toHaveURL(/\/profile/);
      await expect(page.locator('[data-testid="profile-user-card"]')).toBeVisible();

      // Sign out button must be visible without scrolling
      const logoutBtn = page.locator('[data-testid="profile-logout-button"]');
      await expect(logoutBtn).toBeVisible();

      const btnBox = await logoutBtn.boundingBox();
      expect(btnBox).not.toBeNull();
      // On 360x740, bottom of button must be within screen viewport height (less than 740)
      expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(vp.height);
      expect(btnBox!.height).toBeGreaterThanOrEqual(48);

      // Screenshot
      const screenshotPath = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/therapist-profile-${vp.width}px.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      await context.close();
    });
  }

  // 2. Admin Profile Access
  for (const vp of VIEWPORTS) {
    test(`Admin reaches Profile from tab bar (${vp.name})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/admin.json",
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      // Verify tab bar has profile
      const profileTab = page.locator('[data-testid="tab-profile"]').first();
      await expect(profileTab).toBeVisible();
      await profileTab.click();

      await expect(page).toHaveURL(/\/profile/);
      await expect(page.locator('[data-testid="profile-user-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="profile-role-badge"]')).toContainText("Clinic Administrator");

      const logoutBtn = page.locator('[data-testid="profile-logout-button"]');
      await expect(logoutBtn).toBeVisible();
      const btnBox = await logoutBtn.boundingBox();
      expect(btnBox!.height).toBeGreaterThanOrEqual(48);

      // Screenshot
      const screenshotPath = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/admin-profile-${vp.width}px.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      await context.close();
    });
  }

  // 3. Super Admin Profile & More Menu
  for (const vp of VIEWPORTS) {
    test(`Super Admin reaches Profile & Settings (${vp.name})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/super-admin.json",
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      await page.goto("/super-admin/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      // Can reach profile from tab bar
      const profileTab = page.locator('[data-testid="tab-profile"]').first();
      await expect(profileTab).toBeVisible();
      await profileTab.click();

      await expect(page).toHaveURL(/\/profile/);
      await expect(page.locator('[data-testid="profile-role-badge"]')).toContainText("Super Administrator");

      // Verify App Settings version and build ID
      const versionEl = page.locator('[data-testid="settings-app-version"]');
      await expect(versionEl).toBeVisible();
      const versionText = await versionEl.textContent();
      expect(versionText).toContain("v1.5");

      // Fetch /api/health to confirm matching buildId
      const healthRes = await page.request.get("/api/health");
      expect(healthRes.ok()).toBeTruthy();
      const healthData = await healthRes.json();
      expect(versionText).toContain(healthData.buildId);

      // Screenshot
      const screenshotPath = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/super-admin-profile-${vp.width}px.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      await context.close();
    });
  }

  // 4. Super Admin Branches Page with "Open Branch"
  for (const vp of VIEWPORTS) {
    test(`Super Admin Branches page loads with no branch selected and "Open branch" works (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/super-admin.json",
        isMobile: true,
        hasTouch: true,
      });

      // Clear selected branch cookie to test with no branch selected
      await context.clearCookies({ name: "gcs_selected_branch" });

      const page = await context.newPage();

      // Navigate to /admin/branches (via tab bar or direct)
      await page.goto("/admin/branches", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      // Verify page is not 404 or blank
      await expect(page.locator('[data-testid="branches-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="add-branch-btn"]')).toBeVisible();

      // Check open branch button
      const openBtn = page.locator('button[data-testid^="open-branch-btn-"]').first();
      await expect(openBtn).toBeVisible();
      const openBox = await openBtn.boundingBox();
      expect(openBox!.height).toBeGreaterThanOrEqual(44);

      // Screenshot
      const screenshotPath = `C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/branches-page-${vp.width}px.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });

      // Click "Open branch"
      await openBtn.click();
      await page.waitForTimeout(1000);

      // Reaches super admin dashboard with branch query param or active branch
      await expect(page).toHaveURL(/\/super-admin\/dashboard/);

      await context.close();
    });
  }

  // 5. Sign Out deletes session cookie and redirects to /login
  test("Sign Out button redirects to /login and clears session cookie", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: "playwright/.auth/admin.json",
    });
    const page = await context.newPage();

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const logoutBtn = page.locator('[data-testid="profile-logout-button"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Must redirect to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);

    // Verify session cookie is deleted
    const cookies = await context.cookies();
    const sessionCookie = cookies.find((c) => c.name === "gcs_session");
    expect(!sessionCookie || !sessionCookie.value).toBeTruthy();

    await context.close();
  });

  // 6. Button audit on Profile and Branches: touch target >= 44px, no cut-off
  test("Button audit: height >= 44px and scrollWidth <= clientWidth", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      storageState: "playwright/.auth/super-admin.json",
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    for (const route of ["/profile", "/admin/branches"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);

      const buttons = await page.locator("main button:visible").all();
      for (const btn of buttons) {
        const box = await btn.boundingBox();
        if (box && box.height > 0) {
          // Height >= 44px
          expect(box.height).toBeGreaterThanOrEqual(44);

          // No cut-off / overflow: scrollWidth <= clientWidth + 2px tolerance
          const overflows = await btn.evaluate((el) => el.scrollWidth > el.clientWidth + 2);
          expect(overflows).toBeFalsy();
        }
      }
    }

    await context.close();
  });
});
