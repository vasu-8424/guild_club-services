import { test, expect } from "@playwright/test";

test.describe("Capacitor Mobile Shell & Safe Area Inset Verification", () => {
  const viewports = [
    { name: "360x740 (Android Compact)", width: 360, height: 740 },
    { name: "390x844 (iPhone)", width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    test(`${vp.name}: topbar clears 24px top inset, no overlap, no horizontal scroll`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: "playwright/.auth/admin.json",
      });
      const page = await context.newPage();

      // Use Admin session
      await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 });

      // Emulate CSS safe area insets via style tag
      await page.addStyleTag({
        content: `
          header[data-testid="topbar"] {
            padding-top: 24px !important;
          }
          nav[data-testid="bottom-tab-bar"] {
            padding-bottom: 16px !important;
          }
        `,
      });
      await page.waitForTimeout(500);

      // Verify Topbar
      const topbar = page.locator('[data-testid="topbar"]');
      await expect(topbar).toBeVisible();
      const topbarBox = await topbar.boundingBox();
      expect(topbarBox).not.toBeNull();

      // With 24px inset, total header height must be at least 56 + 24 = 80px
      expect(topbarBox!.height).toBeGreaterThanOrEqual(80);

      // The title must be placed BELOW the 24px inset (y >= 24)
      const title = page.locator('[data-testid="topbar-title"]');
      await expect(title).toBeVisible();
      const titleBox = await title.boundingBox();
      expect(titleBox).not.toBeNull();
      expect(titleBox!.y).toBeGreaterThanOrEqual(24);

      // Verify notification button is also below the 24px inset
      const notifBtn = page.locator('[data-testid="notification-bell-btn"]');
      if ((await notifBtn.count()) > 0) {
        const bellBox = await notifBtn.boundingBox();
        expect(bellBox).not.toBeNull();
        expect(bellBox!.y).toBeGreaterThanOrEqual(24);
      }

      // Verify page content starts below the top bar (no overlap)
      const mainContent = page.locator("main");
      const mainBox = await mainContent.boundingBox();
      expect(mainBox).not.toBeNull();
      expect(mainBox!.y).toBeGreaterThanOrEqual(topbarBox!.y + topbarBox!.height - 1);

      // Verify NO horizontal scrollbar
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalScroll).toBe(false);

      // Verify NO "Install" or "APK" text appears anywhere in the visible UI
      const bodyText = await page.innerText("body");
      expect(bodyText).not.toMatch(/\bInstall\b/i);
      expect(bodyText).not.toMatch(/\bAPK\b/);

      await context.close();
    });
  }

  test("Stale UI Guard: detects newer buildId from /api/health and shows update banner without Install/APK text", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: "playwright/.auth/admin.json",
    });
    const page = await context.newPage();

    // Mock /api/health to return a future build ID
    await page.route("**/api/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          app: "Guild Club Services",
          buildId: "gcs-future-build-99999",
          database: "connected",
        }),
      });
    });

    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    // The update banner must appear
    const banner = page.locator('[data-testid="stale-ui-update-banner"]');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText("A new version is available.");

    const updateBtn = page.locator('[data-testid="stale-ui-update-btn"]');
    await expect(updateBtn).toBeVisible();
    await expect(updateBtn).toContainText("Tap to update");

    // Must NOT contain "Install" or "APK"
    const bannerText = await banner.innerText();
    expect(bannerText).not.toMatch(/\bInstall\b/i);
    expect(bannerText).not.toMatch(/\bAPK\b/i);

    await context.close();
  });

  test("Therapist Profile: displays App Version correctly in Settings", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: "playwright/.auth/therapist.json",
    });
    const page = await context.newPage();

    await page.goto("/therapist/profile", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    const versionElem = page.locator('[data-testid="settings-app-version"]');
    await expect(versionElem).toBeVisible();
    const versionText = await versionElem.innerText();
    expect(versionText).toContain("v1.2");

    await context.close();
  });
});
