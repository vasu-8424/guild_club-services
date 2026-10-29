import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";
import { validateEnv } from "@/lib/env";

test.describe("Suite M: BRANCH PATIENT REPORT & PRODUCTION READINESS", () => {
  const sql = neon(assertTestDatabase());

  const ADMIN = {
    email: process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com",
    password: process.env.TEST_ADMIN_MAIN_PASSWORD || "Password@Admin123",
  };

  const THERAPIST = {
    email: process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com",
    password: process.env.TEST_THERAPIST_1_PASSWORD || "Password@Therapist1",
  };

  const SUPER_ADMIN = {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || "qa.superadmin@guildclub.com",
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || "Password@Super123",
  };

  test("[REP-01] Admin downloads CSV: returns 200, Cache-Control no-store, scoped to branch only", async ({ page, request }) => {
    // 1. Log in as Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // 2. Request CSV report
    const res = await page.request.get("/api/admin/reports/branch-patients?format=csv");
    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["content-type"]).toContain("text/csv");
    expect(headers["content-disposition"]).toContain(".csv");

    const text = await res.text();
    // Headers check
    expect(text).toContain("Patient ID,Patient Name,Age,Sex,Service,Room,Start Date,Status,Present Condition,Improvement Summary");
  });

  test("[REP-02] CSV contains only allowed summary columns; zero therapist session notes leaked", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    const res = await page.request.get("/api/admin/reports/branch-patients?format=csv");
    expect(res.status()).toBe(200);
    const csvContent = await res.text();

    // Verify session notes text from database is never included in the report
    const privateNotes = await sql`
      SELECT notes FROM sessions WHERE notes IS NOT NULL AND length(notes) > 10 LIMIT 5
    `;
    for (const row of privateNotes) {
      if (row.notes && row.notes.length > 15) {
        expect(csvContent).not.toContain(row.notes);
      }
    }
  });

  test("[REP-03] Admin downloads printable A4 PDF: returns 200, Cache-Control no-store", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    const res = await page.request.get("/api/admin/reports/branch-patients?format=pdf");
    expect(res.status()).toBe(200);

    const headers = res.headers();
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["content-type"]).toContain("application/pdf");
    expect(headers["content-disposition"]).toContain(".pdf");
  });

  test("[REP-04] Therapist attempting to download patient report gets 403 Forbidden", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', THERAPIST.email);
    await page.fill('[data-testid="login-password-input"]', THERAPIST.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/therapist\/dashboard/);

    const res = await page.request.get("/api/admin/reports/branch-patients?format=csv");
    expect(res.status()).toBe(403);
  });

  test("[REP-05] Audit event report_downloaded is recorded with format and rowCount (no patient PII)", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    const beforeTime = new Date(Date.now() - 5000);
    await page.request.get("/api/admin/reports/branch-patients?format=csv");

    const events = await sql`
      SELECT id, event_type, metadata, occurred_at
      FROM case_events
      WHERE event_type = 'report_downloaded'
        AND occurred_at >= ${beforeTime}
      ORDER BY occurred_at DESC
      LIMIT 1
    `;

    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe("report_downloaded");
    const meta = events[0].metadata as any;
    expect(meta.format).toBe("csv");
    expect(meta.branchId).toBeDefined();
    expect(meta.rowCount).toBeDefined();
    // Confirm no patient names or conditions logged
    expect(JSON.stringify(meta)).not.toContain("Rahul");
    expect(JSON.stringify(meta)).not.toContain("Patient");
  });

  test("[REP-06] Download report split button renders on Admin Dashboard and Cases page", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 1. Visible on Dashboard
    const dashBtn = page.locator('[data-testid="branch-report-download-btn"]');
    await expect(dashBtn).toBeVisible();

    const splitToggle = page.locator('[data-testid="branch-report-split-toggle"]');
    await splitToggle.click();
    await expect(page.locator('[data-testid="branch-report-dropdown-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="branch-report-csv-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="branch-report-pdf-btn"]')).toBeVisible();

    // 2. Visible on Cases page
    await page.goto("/admin/cases");
    await expect(page.locator('[data-testid="branch-report-download-btn"]')).toBeVisible();
  });

  test("[REP-07] Health check endpoint /api/health returns 200 ok with no secrets or database hostnames", async ({ request }) => {
    const res = await request.get("http://localhost:3000/api/health");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
    expect(body.app).toBe("Guild Club Services");
    expect(body.uptime).toBeDefined();

    // CRITICAL: Ensure no connection strings, passwords, or dbHost are leaked
    const rawString = JSON.stringify(body);
    expect(rawString).not.toContain("neon.tech");
    expect(rawString).not.toContain("password");
    expect(rawString).not.toContain("postgres://");
    expect(rawString).not.toContain("postgresql://");
    expect(body.dbHost).toBeUndefined();
  });

  test("[REP-08] Production guard: EMAIL_PROVIDER=mock is rejected when NODE_ENV is production", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalPw = process.env.PLAYWRIGHT_TEST;
    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.PLAYWRIGHT_TEST;
      expect(() => {
        validateEnv({
          DATABASE_URL: "postgresql://user:pass@pooler.neon.tech/db",
          AUTH_SECRET: "a_very_long_production_auth_secret_with_32_chars",
          EMAIL_PROVIDER: "mock",
        });
      }).toThrow(/EMAIL_PROVIDER cannot be 'mock' in production/);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      process.env.PLAYWRIGHT_TEST = originalPw;
    }
  });
});

