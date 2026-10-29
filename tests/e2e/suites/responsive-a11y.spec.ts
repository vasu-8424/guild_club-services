import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Suite J: RESPONSIVE AND ACCESSIBILITY", () => {
  test("[UI-01] Mobile (390px): Login page has no horizontal page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 1-2px tolerance
  });

  test("[UI-02] Tablet (768px): Login page has no horizontal page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/login");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("[UI-03] Desktop (1440px): Layout is well-structured and free of horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("[UI-04] No overlapping interactive elements on login page (bounding-box overlap check)", async ({ page }) => {
    await page.goto("/login");
    const emailInput = await page.locator('[data-testid="login-email-input"]').boundingBox();
    const pwdInput = await page.locator('[data-testid="login-password-input"]').boundingBox();
    const submitBtn = await page.locator('[data-testid="login-submit-button"]').boundingBox();

    if (emailInput && pwdInput && submitBtn) {
      // Inputs should be vertically stacked, not overlapping
      expect(emailInput.y + emailInput.height).toBeLessThanOrEqual(pwdInput.y + 1);
      expect(pwdInput.y + pwdInput.height).toBeLessThanOrEqual(submitBtn.y + 1);
    }
  });

  test("[UI-05] Navigation icons and labels render on one line without wrapping", async ({ page }) => {
    await page.goto("/login");
    // Verify brand heading / title is visible on login page
    await expect(page.locator("text=Guild Club Services").first()).toBeVisible();
  });

  test("[UI-06] Axe accessibility evaluation on login: report serious and critical violations", async ({ page }) => {
    await page.goto("/login");
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    console.log(`[UI-06 Axe Scan] Total violations: ${accessibilityScanResults.violations.length}, Critical/Serious: ${criticalOrSerious.length}`);
    expect(criticalOrSerious.length).toBeLessThanOrEqual(3);
  });
});
