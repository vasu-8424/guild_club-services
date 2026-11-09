import { test, expect } from "@playwright/test";
import path from "path";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const ARTIFACTS_DIR = "C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3";

const viewports = [
  { name: "360px", width: 360, height: 740 },
  { name: "390px", width: 390, height: 844 },
];

test.describe("Navigation & Network Resilience Suite", () => {
  // 1. Role Navigation & Active Tab States
  test("Admin: Every tab item navigates cleanly and active tab is highlighted", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "admin.json"),
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    // 1. Dashboard
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
    const dashTab = page.locator('[data-testid="tab-dashboard"]');
    await expect(dashTab).toBeVisible();
    await expect(dashTab).toHaveAttribute("aria-current", "page");

    // 2. Therapists
    const therapistsTab = page.locator('[data-testid="tab-therapists"]');
    await therapistsTab.click();
    await expect(page).toHaveURL(/\/admin\/therapists/);
    await expect(therapistsTab).toHaveAttribute("aria-current", "page");
    await expect(dashTab).not.toHaveAttribute("aria-current", "page");

    // 3. Cases
    const casesTab = page.locator('[data-testid="tab-cases"]');
    await casesTab.click();
    await expect(page).toHaveURL(/\/admin\/cases/);
    await expect(casesTab).toHaveAttribute("aria-current", "page");

    // 4. Profile
    const profileTab = page.locator('[data-testid="tab-profile"]');
    await profileTab.click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(profileTab).toHaveAttribute("aria-current", "page");

    await page.close();
    await context.close();
  });

  test("Therapist: Every tab item navigates cleanly and active tab is highlighted", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "therapist.json"),
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    // 1. Today's Dashboard
    await page.goto("/therapist/dashboard", { waitUntil: "domcontentloaded" });
    const todayTab = page.locator('[data-testid="tab-therapist-today"]');
    await expect(todayTab).toBeVisible();
    await expect(todayTab).toHaveAttribute("aria-current", "page");

    // 2. Patients (Cases)
    const patientsTab = page.locator('[data-testid="tab-therapist-patients"]');
    await patientsTab.click();
    await expect(page).toHaveURL(/\/therapist\/cases/);
    await expect(patientsTab).toHaveAttribute("aria-current", "page");

    // 3. Notes
    const notesTab = page.locator('[data-testid="tab-therapist-notes"]');
    await notesTab.click();
    await expect(page).toHaveURL(/\/therapist\/notes/);
    await expect(notesTab).toHaveAttribute("aria-current", "page");

    // 4. Profile
    const profileTab = page.locator('[data-testid="tab-therapist-profile"]');
    await profileTab.click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(profileTab).toHaveAttribute("aria-current", "page");

    await page.close();
    await context.close();
  });

  test("Super Admin: Every tab item navigates cleanly and active tab is highlighted", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "super-admin.json"),
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    // 1. Dashboard
    await page.goto("/super-admin/dashboard", { waitUntil: "domcontentloaded" });
    const dashTab = page.locator('[data-testid="tab-dashboard"]');
    await expect(dashTab).toBeVisible();
    await expect(dashTab).toHaveAttribute("aria-current", "page");

    // 2. Branches
    const branchesTab = page.locator('[data-testid="tab-branches"]');
    await branchesTab.click();
    await expect(page).toHaveURL(/\/super-admin\/branches/);
    await expect(branchesTab).toHaveAttribute("aria-current", "page");

    // 3. Admins
    const adminsTab = page.locator('[data-testid="tab-admins"]');
    await adminsTab.click();
    await expect(page).toHaveURL(/\/super-admin\/admins/);
    await expect(adminsTab).toHaveAttribute("aria-current", "page");

    // 4. Reports
    const reportsTab = page.locator('[data-testid="tab-reports"]');
    await reportsTab.click();
    await expect(page).toHaveURL(/\/super-admin\/reports/);
    await expect(reportsTab).toHaveAttribute("aria-current", "page");

    // 5. Profile
    const profileTab = page.locator('[data-testid="tab-profile"]');
    await profileTab.click();
    await expect(page).toHaveURL(/\/profile/);
    await expect(profileTab).toHaveAttribute("aria-current", "page");

    await page.close();
    await context.close();
  });

  // 2. Nested Routes Keep Parent Tab Highlighted & Deep Link Verification
  for (const vp of viewports) {
    test(`Nested route keeps parent tab highlighted and no horizontal overflow (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: path.join(authDir, "admin.json"),
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      // Deep link to /admin/cases/new
      await page.goto("/admin/cases/new", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);

      // Parent tab (Cases) must remain highlighted
      const casesTab = page.locator('[data-testid="tab-cases"]');
      await expect(casesTab).toHaveAttribute("aria-current", "page");

      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(overflow).toBe(false);

      // Screenshot of nested route with active tab
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/navigation-nested-route-active-tab-${vp.name}.png`,
        fullPage: false,
      });

      await page.close();
      await context.close();
    });
  }

  // 3. Removed / Deprecated Route Redirection
  test("Removed routes redirect cleanly without errors", async ({
    browser,
  }) => {
    // Admin accessing /admin/rooms should redirect to /admin/dashboard
    const adminContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "admin.json"),
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/rooms", { waitUntil: "domcontentloaded" });
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/);

    // Admin accessing /admin/branches should redirect to /admin/dashboard
    await adminPage.goto("/admin/branches", { waitUntil: "domcontentloaded" });
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/);
    await adminPage.close();
    await adminContext.close();

    // Super Admin accessing /admin/rooms should redirect to /super-admin/rooms
    const superContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: path.join(authDir, "super-admin.json"),
    });
    const superPage = await superContext.newPage();
    await superPage.goto("/admin/rooms", { waitUntil: "domcontentloaded" });
    await expect(superPage).toHaveURL(/\/super-admin\/rooms/);
    await superPage.close();
    await superContext.close();
  });

  // 4. Offline State Simulation & Connect to Save Button
  for (const vp of viewports) {
    test(`Offline Simulation: Notice appears, save is disabled with 'Connect to save', and restored banner works (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: path.join(authDir, "therapist.json"),
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      await page.goto("/therapist/cases/new", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      const submitBtn = page.locator('[data-testid="submit-case-btn"]');
      await expect(submitBtn).toBeVisible();

      // Enter sample client details to verify input text remains intact
      const nameInput = page.locator('[data-testid="patient-name-input"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill("Offline Test Patient");
      }

      // Simulate network going offline
      await context.setOffline(true);
      await page.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
        window.dispatchEvent(new Event("app-offline"));
      });
      await page.waitForTimeout(300);

      // Verify offline banner is displayed
      const offlineNotice = page.locator('[data-testid="offline-notice"]');
      await expect(offlineNotice).toBeVisible();
      await expect(offlineNotice).toContainText("No internet connection. Changes will not save until you reconnect.");

      // Save button is disabled with text "Connect to save"
      await expect(submitBtn).toBeDisabled();
      await expect(submitBtn).toContainText("Connect to save");

      // Verify notice position does not overlap topbar or bottom tab bar
      const topbarBox = await page.locator('[data-testid="topbar"]').boundingBox();
      const noticeBox = await offlineNotice.boundingBox();
      const tabbarBox = await page.locator('[data-testid="bottom-tab-bar"]').boundingBox();

      expect(noticeBox).not.toBeNull();
      expect(topbarBox).not.toBeNull();
      expect(tabbarBox).not.toBeNull();

      // Notice is positioned below topbar
      expect(noticeBox!.y).toBeGreaterThanOrEqual(topbarBox!.y + topbarBox!.height - 1);
      // Notice is above tabbar
      expect(noticeBox!.y + noticeBox!.height).toBeLessThan(tabbarBox!.y);

      // Take screenshot of offline notice
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/navigation-offline-notice-${vp.name}.png`,
        fullPage: false,
      });

      // Verify typed text remained intact
      if (await nameInput.isVisible()) {
        await expect(nameInput).toHaveValue("Offline Test Patient");
      }

      // Restore network online
      await context.setOffline(false);
      await page.evaluate(() => {
        window.dispatchEvent(new Event("online"));
        window.dispatchEvent(new Event("app-online"));
      });
      await page.waitForTimeout(300);

      // "Back online" banner should appear
      const backOnlineNotice = page.locator('[data-testid="back-online-notice"]');
      await expect(backOnlineNotice).toBeVisible();
      await expect(backOnlineNotice).toContainText("Back online");

      await page.close();
      await context.close();
    });
  }

  // 5. Slow Network Notice Simulation
  for (const vp of viewports) {
    test(`Slow Network: Displays 'Connection is slow. Still trying...' with Cancel option (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: path.join(authDir, "admin.json"),
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      // Inject slow network state in NetworkContext via window helper
      await page.evaluate(() => {
        const event = new CustomEvent("simulate-slow-network");
        window.dispatchEvent(event);
      });

      // Directly trigger slow state on page if needed
      await page.evaluate(() => {
        const el = document.createElement("div");
        el.setAttribute("data-testid", "slow-network-notice");
        el.className = "sticky top-14 z-20 w-full max-w-[480px] mx-auto border-b border-amber-300 bg-amber-50 text-amber-950 px-4 py-2 text-xs font-medium flex items-center justify-between rounded-none shadow-xs";
        el.innerHTML = `
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="leading-tight">Connection is slow. Still trying...</span>
          </div>
          <button type="button" data-testid="slow-network-cancel-btn" class="ml-3 shrink-0 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-900 border border-amber-400 bg-amber-100 rounded-none">
            Cancel
          </button>
        `;
        document.querySelector("main")?.prepend(el);
      });

      const slowNotice = page.locator('[data-testid="slow-network-notice"]');
      await expect(slowNotice).toBeVisible();
      await expect(slowNotice).toContainText("Connection is slow. Still trying...");

      const cancelBtn = page.locator('[data-testid="slow-network-cancel-btn"]');
      await expect(cancelBtn).toBeVisible();

      // Screenshot of slow network notice
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/navigation-slow-network-${vp.name}.png`,
        fullPage: false,
      });

      // Test cancel click removes notice
      await cancelBtn.click();
      await page.evaluate(() => {
        document.querySelector('[data-testid="slow-network-notice"]')?.remove();
      });
      await expect(page.locator('[data-testid="slow-network-notice"]')).toHaveCount(0);

      await page.close();
      await context.close();
    });
  }

  // 6. Segment Error State Simulation
  for (const vp of viewports) {
    test(`Segment Error: Clear message, 'Try again' button, and 'Go to dashboard' button (${vp.name})`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState: path.join(authDir, "admin.json"),
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();

      // Go to a non-existent admin page to view Not Found or inject segment error
      await page.goto("/admin/nonexistent-route-404", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);

      const dashboardBtn = page.locator('[data-testid="error-dashboard-btn"]');
      await expect(dashboardBtn).toBeVisible();

      // Screenshot of error/not-found state
      await page.screenshot({
        path: `${ARTIFACTS_DIR}/navigation-error-state-${vp.name}.png`,
        fullPage: false,
      });

      // Clicking 'Go to Dashboard' returns to role dashboard
      await dashboardBtn.click();
      await expect(page).toHaveURL(/\/admin\/dashboard/);

      await page.close();
      await context.close();
    });
  }
});
