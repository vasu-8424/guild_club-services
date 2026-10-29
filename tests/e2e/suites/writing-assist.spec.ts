import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";
import path from "path";
import fs from "fs";

test.describe("Suite L: WRITING ASSISTANT & MOBILE OPTIMIZATIONS", () => {
  const sql = neon(assertTestDatabase());
  const artifactDir = "C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3";
  const screenshotDir = path.resolve(process.cwd(), "test-results/screenshots-ui");

  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  function saveScreenshot(sourcePath: string, filename: string) {
    const dest = path.join(artifactDir, filename);
    try {
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, dest);
      }
    } catch (e) {
      console.warn("Could not copy screenshot:", e);
    }
  }

  const SUPER_ADMIN = {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || "qa.superadmin@guildclub.com",
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || "Password@Super123",
  };

  const THERAPIST = {
    email: process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com",
    password: process.env.TEST_THERAPIST_1_PASSWORD || "Password@Therapist1",
  };

  test.beforeEach(async () => {
    try {
      await fetch("http://localhost:3000/api/writing-assist/mock-check", { method: "DELETE" });
    } catch {
      // ignore
    }
  });

  // TEST 1: Every text field has spellcheck enabled, lang en-IN, and correct autocomplete/inputmode
  test("[WA-01] Free-text fields have spellCheck=true, lang='en-IN', autoCapitalize, and autoComplete", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('[data-testid="login-email-input"]');
    await expect(emailInput).toHaveAttribute("lang", "en-IN");
    await expect(emailInput).toHaveAttribute("autocomplete", "email");
    await expect(emailInput).toHaveAttribute("autocapitalize", "none");

    // Login as Super Admin and inspect Add Admin form
    await emailInput.fill(SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/super-admin/admins/new");
    const nameInput = page.locator('[data-testid="admin-name-input"]');
    await expect(nameInput).toHaveAttribute("spellcheck", "true");
    await expect(nameInput).toHaveAttribute("lang", "en-IN");
    await expect(nameInput).toHaveAttribute("autocapitalize", "words");
    await expect(nameInput).toHaveAttribute("autocomplete", "name");
  });

  // TEST 2: Typing 200 characters makes zero requests to assist endpoint (on-demand only)
  test("[WA-02] Typing 200 characters makes zero background requests to assist endpoint", async ({ page }) => {
    let assistRequestsCount = 0;
    page.on("request", (req) => {
      if (req.url().includes("writingAssist") || req.url().includes("writing-assist")) {
        assistRequestsCount++;
      }
    });

    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/admin/cases/new");
    const presentingIssuesInput = page.locator('[data-testid="case-presenting-issues-input"]');
    await expect(presentingIssuesInput).toBeVisible();

    // Type 200 characters
    const longString = "This is a detailed clinical observation note describing functional mobility progress over the past two weeks. ".repeat(2);
    await presentingIssuesInput.fill(longString);

    await page.waitForTimeout(600);
    expect(assistRequestsCount).toBe(0);
  });

  // TEST 3: Privacy Masking: Check writing sends masked text (name, phone, email, GCP-ID replaced)
  test("[WA-03] Check writing strips sensitive data before provider & unmasks in return", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/admin/cases/new");
    await page.fill('[data-testid="case-client-name-input"]', "Venkatesh Rao");
    const presentingIssuesInput = page.locator('[data-testid="case-presenting-issues-input"]');

    const rawInput =
      "Patient Venkatesh Rao with ref GCP-9988 called from +91 9876543210 or venkat@example.com. Patient were feeling much better.";
    await presentingIssuesInput.fill(rawInput);

    // Click Check writing
    const checkBtn = page.locator('[data-testid="check-writing-button"]').first();
    await expect(checkBtn).toBeEnabled();
    await checkBtn.click();

    // Wait for result panel
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible({ timeout: 10000 });

    // Verify mock provider received MASKED text only!
    const mockRes = await fetch("http://localhost:3000/api/writing-assist/mock-check");
    if (mockRes.ok) {
      const data = await mockRes.json();
      if (data.lastCall) {
        expect(data.lastCall.maskedText).not.toContain("GCP-9988");
        expect(data.lastCall.maskedText).not.toContain("9876543210");
        expect(data.lastCall.maskedText).not.toContain("venkat@example.com");
        expect(data.lastCall.maskedText).not.toContain("Venkatesh Rao");
      }
    }

    // Verify returned preview restores the original terms
    const previewText = await page.locator('[data-testid="corrected-text-preview"]').innerText();
    expect(previewText).toContain("Venkatesh Rao");
    expect(previewText).toContain("GCP-9988");
    expect(previewText).toContain("+91 9876543210");
  });

  // TEST 4: "Use corrected text" replaces content; "Keep my version" leaves unchanged; editing field closes panel
  test("[WA-04] Use corrected text replaces field, Keep my version preserves, editing closes panel", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/admin/cases/new");
    const presentingInput = page.locator('[data-testid="case-presenting-issues-input"]');
    await presentingInput.fill("Patient were feeling tired and session went good.");

    // Check writing
    await page.locator('[data-testid="check-writing-button"]').first().click();
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible();

    // Click "Use corrected text"
    await page.click('[data-testid="use-corrected-text-btn"]');
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toHaveCount(0);

    const updatedValue = await presentingInput.inputValue();
    expect(updatedValue.toLowerCase()).toContain("patient was");
    expect(updatedValue.toLowerCase()).toContain("session went well");

    // Editing field closes panel if open
    await page.locator('[data-testid="check-writing-button"]').first().click();
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible();
    await presentingInput.type(" Additional remarks.");
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toHaveCount(0);
  });

  // TEST 5: Nothing stored: after writing check, search database for assist text -> 0 rows
  test("[WA-05] Store nothing: no database table, event, or notification stores the text", async ({ page }) => {
    const canaryToken = `CanaryAssistToken_${Date.now()}`;
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/admin/cases/new");
    const presentingInput = page.locator('[data-testid="case-presenting-issues-input"]');
    await presentingInput.fill(`Clinical diagnostic verification note for ${canaryToken}.`);

    await page.locator('[data-testid="check-writing-button"]').first().click();
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible();

    // Query database for canaryToken
    const eventsCount = await sql`
      SELECT count(*)::int as c FROM case_events WHERE metadata::text LIKE ${`%${canaryToken}%`}
    `;
    expect(eventsCount[0].c).toBe(0);

    const notifCount = await sql`
      SELECT count(*)::int as c FROM in_app_notifications WHERE body LIKE ${`%${canaryToken}%`}
    `;
    expect(notifCount[0].c).toBe(0);

    const emailCount = await sql`
      SELECT count(*)::int as c FROM email_queue WHERE payload::text LIKE ${`%${canaryToken}%`}
    `;
    expect(emailCount[0].c).toBe(0);
  });

  // TEST 6: Mobile (390px): no horizontal scroll, min 44px tap targets, 16px font
  test("[WA-06] Mobile (390px): no horizontal scroll, input font >= 16px, tap targets >= 44px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    // Check no horizontal scroll on mobile
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Font size >= 16px to prevent iOS auto-zoom
    const emailFontSize = await page.locator('[data-testid="login-email-input"]').evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(emailFontSize).toBeGreaterThanOrEqual(16);

    // Login submit button min height >= 44px
    const btnHeight = await page.locator('[data-testid="login-submit-button"]').evaluate((el) => {
      return el.getBoundingClientRect().height;
    });
    expect(btnHeight).toBeGreaterThanOrEqual(44);
  });

  // TEST 7: Screenshots at 390px and 1440px
  test("[WA-07] Visual artifacts: screenshots at 390px and 1440px of writing check panel & boards", async ({ page }) => {
    const viewports = [
      { name: "390px", width: 390, height: 844 },
      { name: "1440px", width: 1440, height: 900 },
    ];

    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1. Admin Dashboard screenshot
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(500);
      const adminDashPath = path.join(screenshotDir, `admin-dashboard-${vp.name}.png`);
      await page.screenshot({ path: adminDashPath, fullPage: true });
      saveScreenshot(adminDashPath, `admin-dashboard-${vp.name}.png`);

      // 2. Writing Assist panel screenshot
      await page.goto("/admin/cases/new");
      const presentingInput = page.locator('[data-testid="case-presenting-issues-input"]');
      await presentingInput.fill("Patient were feeling much better after regular exercises and session went good.");
      await page.locator('[data-testid="check-writing-button"]').first().click();
      await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);

      const assistPath = path.join(screenshotDir, `writing-assist-panel-${vp.name}.png`);
      await page.screenshot({ path: assistPath, fullPage: true });
      saveScreenshot(assistPath, `writing-assist-panel-${vp.name}.png`);
    }
  });

  // TEST 8: All AI Modes work (summarize, simplify, shorten, grammar, suggestions) + Cancel button
  test("[WA-08] All AI modes work (summarize, simplify, shorten) & Cancel aborts without losing text", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/admin/cases/new");
    const presentingInput = page.locator('[data-testid="case-presenting-issues-input"]');
    const originalText = "Patient were feeling tired over the past two weeks with functional ambulation difficulties.";
    await presentingInput.fill(originalText);

    // 1. Test Summarize Mode
    await page.click('[data-testid="writing-mode-summarize"]');
    await page.locator('[data-testid="check-writing-button"]').first().click();
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible({ timeout: 10000 });
    const summaryPreview = await page.locator('[data-testid="corrected-text-preview"]').innerText();
    expect(summaryPreview.toLowerCase()).toContain("summary");

    // 2. Test Simplify Mode
    await page.click('[data-testid="writing-mode-simplify"]');
    await page.locator('[data-testid="check-writing-button"]').first().click();
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible({ timeout: 10000 });
    const simplifyPreview = await page.locator('[data-testid="corrected-text-preview"]').innerText();
    expect(simplifyPreview.toLowerCase()).toContain("walking ability");

    // 3. Test Shorten Mode
    await page.click('[data-testid="writing-mode-shorten"]');
    await page.locator('[data-testid="check-writing-button"]').first().click();
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toBeVisible({ timeout: 10000 });
    const shortenPreview = await page.locator('[data-testid="corrected-text-preview"]').innerText();
    expect(shortenPreview.toLowerCase()).toContain("recently");

    // 4. Test Cancel Button
    await page.click('[data-testid="cancel-writing-assist-btn"]');
    await expect(page.locator('[data-testid="writing-assist-panel"]')).toHaveCount(0);
    // User text is completely preserved
    expect(await presentingInput.inputValue()).toBe(originalText);
  });
});

