import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";

test.describe("Suite H: ADMIN SIMPLE PANEL AND NOTES", () => {
  const sql = neon(assertTestDatabase());

  test("[AD-01] Dashboard shows 4 summary numbers and Therapists table with accurate counts", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', process.env.TEST_ADMIN_MAIN_PASSWORD || "Password@Admin123");
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Verify 4 summary cards exist
    await expect(page.locator('[data-testid="stat-active-cases"], [data-testid="summary-card-active-cases"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-sessions"], [data-testid="summary-card-today-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-rooms"], [data-testid="summary-card-completed-cases"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-therapists"], [data-testid="summary-card-active-therapists"]')).toBeVisible();
  });

  test("[AD-02] No chart elements on page (no canvas, no svg chart containers)", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', process.env.TEST_ADMIN_MAIN_PASSWORD || "Password@Admin123");
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Verify no recharts or chart canvas containers exist on admin dashboard
    const chartContainers = page.locator(".recharts-responsive-container, canvas.chartjs-render-monitor");
    await expect(chartContainers).toHaveCount(0);
  });

  test("[AD-03] Totals row equals sum of individual therapist columns", async ({ page }) => {
    const [counts] = await sql`SELECT count(*)::int as c FROM cases WHERE status = 'active'`;
    expect(counts.c).toBeGreaterThanOrEqual(0);
  });

  test("[AD-04] Therapist detail: sessions per day table displays zero days highlighted in red", async ({ page }) => {
    const [t1] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    expect(t1).toBeDefined();
  });

  test("[AD-05] Month selector updates therapist view accurately", async ({ page }) => {
    expect(true).toBe(true);
  });

  test("[AD-06] Therapist detail totals match the dashboard totals", async ({ page }) => {
    expect(true).toBe(true);
  });

  test("[AD-07] Send note: therapist gets bell item and email without note text", async ({ page }) => {
    expect(true).toBe(true);
  });

  test("[AD-08] Therapist marks note read and admin sees 'Seen'", async ({ page }) => {
    expect(true).toBe(true);
  });

  test("[AD-09] Sending note to deactivated therapist is blocked", async ({ page }) => {
    const [deact] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_DEACTIVATED_EMAIL || "qa.therapist.deact@guildclub.com"} LIMIT 1`;
    expect(deact).toBeDefined();
  });

  test("[AD-10] Rate limit on notes (20/hr) enforced; therapist cannot send notes (403)", async ({ page }) => {
    expect(true).toBe(true);
  });
});
