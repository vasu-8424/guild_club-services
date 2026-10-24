/**
 * Stage 2 – Email Queue & Password Reset Flow Tests
 * Verifies email worker processing and removal of public forgot-password flow.
 */
import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";

test.describe("EML & PWR: Email Processor & Password Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("EML-01: Enqueue a test case_assigned email and verify GET /api/email/process marks it sent", async ({ request }) => {
    const sql = neon(assertTestDatabase());

    // 1. Insert a pending test email
    const testToEmail = `test.worker.${Date.now()}@guildclubtest.com`;
    await sql.query(
      `INSERT INTO email_queue (to_email, to_name, template, payload, status)
       VALUES ($1, 'Test Worker', 'case_assigned', $2::jsonb, 'pending')`,
      [
        testToEmail,
        JSON.stringify({
          therapistName: "Worker Test",
          caseNumber: "GCS-TEST-001",
          priority: "high",
          category: "Individual Therapy",
          clientName: "John Doe",
          caseId: "00000000-0000-0000-0000-000000000001",
        }),
      ]
    );

    // 2. Call the processor endpoint
    const res = await request.get("/api/email/process");
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.processed).toBeGreaterThan(0);

    // 3. Verify status in DB changed from pending to sent
    const rows = await sql.query(
      "SELECT status, sent_at FROM email_queue WHERE to_email = $1",
      [testToEmail]
    );
    expect(rows.length).toBe(1);
    expect(rows[0]["status"]).toBe("sent");
    expect(rows[0]["sent_at"]).not.toBeNull();
  });

  test("EML-02: POST /api/email/process returns structured stats { processed, succeeded, failed }", async ({ request }) => {
    const res = await request.post("/api/email/process");
    expect(res.status()).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty("processed");
    expect(json.data).toHaveProperty("succeeded");
    expect(json.data).toHaveProperty("failed");
    expect(typeof json.data.processed).toBe("number");
  });

  test("PWR-01: Public forgot-password route is hidden and redirects to /login", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/\/login/);
  });

  test("PWR-02: Public reset-password route is hidden and redirects to /login", async ({ page }) => {
    await page.goto("/reset-password?token=some_token");
    await expect(page).toHaveURL(/\/login/);
  });
});
