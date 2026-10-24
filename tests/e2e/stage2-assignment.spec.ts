/**
 * Stage 2 – Case Assignment Tests (ASG-01 to ASG-08)
 * Admin assigns cases to therapists. Assignment triggers email notification.
 */
import { test, expect } from "@playwright/test";
import { getLatestEmail, getEvents } from "../helpers/stage2-helpers";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? "test.admin@guildclub.com",
  password: process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin@123",
};

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', ADMIN.email);
  await page.fill('[data-testid="login-password-input"]', ADMIN.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
}

async function getTestCaseAndTherapist() {
  const sql = neon(assertTestDatabase());
  // Get the most recently created unassigned case
  const caseRows = await sql.query(
    "SELECT id, case_number, status FROM cases WHERE status = 'new' ORDER BY created_at DESC LIMIT 1"
  );
  // Get the seeded test therapist
  const therapistRows = await sql.query(
    "SELECT id, name, email FROM users WHERE role = 'therapist' AND is_active = true ORDER BY created_at ASC LIMIT 1"
  );
  return {
    testCase: caseRows[0] as { id: string; case_number: string; status: string } | undefined,
    therapist: therapistRows[0] as { id: string; name: string; email: string } | undefined,
  };
}

test.describe.serial("ASG: Admin – Case Assignment", () => {
  test.beforeAll(async () => {
    const sql = neon(assertTestDatabase());
    const cases = await sql.query("SELECT id FROM cases WHERE status = 'new' LIMIT 1");
    if (cases.length === 0) {
      const admin = await sql.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const adminId = admin[0]["id"] as string;
      const client = await sql.query(
        `INSERT INTO clients (full_name, email, phone, age, gender)
         VALUES ('Assign Test Client', 'assign.client@test.com', '+91 9888800001', 25, 'Female')
         RETURNING id`
      );
      const clientId = client[0]["id"] as string;
      const curYear = new Date().getFullYear();
      await sql.query(
        `INSERT INTO cases (case_number, client_id, category, priority, status, description, created_by)
         VALUES ($1, $2, 'Individual Therapy', 'high', 'new', 'Test case for assignment spec', $3)`,
        [`GCS-${curYear}-7777`, clientId, adminId]
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("ASG-01: Assignment section appears on case detail page", async ({ page }) => {
    const { testCase } = await getTestCaseAndTherapist();
    if (!testCase) {
      test.skip();
      return;
    }
    await page.goto(`/admin/cases/${testCase.id}`);
    await expect(page.getByTestId("assign-therapist-select")).toBeVisible({ timeout: 10000 });
  });

  test("ASG-02: Therapist dropdown is populated with active therapists", async ({ page }) => {
    const { testCase } = await getTestCaseAndTherapist();
    if (!testCase) {
      test.skip();
      return;
    }
    await page.goto(`/admin/cases/${testCase.id}`);
    const select = page.getByTestId("assign-therapist-select");
    await expect(select).toBeVisible({ timeout: 10000 });
    const options = await select.locator("option").all();
    // At least the seeded therapist should be available (plus placeholder)
    expect(options.length).toBeGreaterThan(1);
  });

  test("ASG-03: Admin can assign a case to a therapist", async ({ page }) => {
    const { testCase, therapist } = await getTestCaseAndTherapist();
    if (!testCase || !therapist) {
      test.skip();
      return;
    }

    await page.goto(`/admin/cases/${testCase.id}`);
    await page.getByTestId("assign-therapist-select").selectOption(therapist.id);
    await page.getByTestId("assign-notes-input").fill("Urgent - please contact client within 24 hours.");
    await page.locator('[data-testid="assign-submit-button"], [data-testid="assign-case-submit"]').first().click();

    // Expect success feedback
    await expect(page.getByTestId("assign-success-message")).toBeVisible({ timeout: 15000 });
  });

  test("ASG-04: Assignment queues case_assigned email to therapist", async ({ page }) => {
    const { therapist } = await getTestCaseAndTherapist();
    if (!therapist) {
      test.skip();
      return;
    }
    void page;
    const email = await getLatestEmail(therapist.email, "case_assigned");
    expect(email, "case_assigned email should be queued to therapist").not.toBeNull();
  });

  test("ASG-05: Case status changes to 'assigned' after assignment", async ({ page }) => {
    void page;
    const sql = neon(assertTestDatabase());
    const rows = await sql.query(
      "SELECT status FROM cases WHERE status = 'assigned' ORDER BY created_at DESC LIMIT 1"
    );
    expect(rows.length, "At least one assigned case should exist").toBeGreaterThan(0);
    expect(rows[0]["status"]).toBe("assigned");
  });

  test("ASG-06: case_assigned event is recorded in case_events", async ({ page }) => {
    void page;
    const sql = neon(assertTestDatabase());
    const rows = await sql.query(
      "SELECT * FROM case_events WHERE event_type = 'case_assigned' ORDER BY occurred_at DESC LIMIT 1"
    );
    expect(rows.length, "case_assigned event must be recorded").toBeGreaterThan(0);
  });

  test("ASG-07: Assigned case appears in therapist dashboard as pending invitation", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_THERAPIST_EMAIL ?? "test.therapist@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', process.env.TEST_THERAPIST_PASSWORD ?? "TestTherapist@123");
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    // The assigned case invitation should be visible
    await expect(page.locator("body")).toContainText(/accept|invitation|assigned/i, { timeout: 10000 });
  });

  test("ASG-08: Unauthenticated POST to /api/admin/cases/[id]/assign returns 401", async ({ request }) => {
    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT id FROM cases LIMIT 1");
    if (rows.length === 0) {
      test.skip();
      return;
    }
    const caseId = rows[0]["id"] as string;
    const res = await request.post(`/api/admin/cases/${caseId}/assign`, {
      data: { therapistId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status()).toBe(401);
  });
});
