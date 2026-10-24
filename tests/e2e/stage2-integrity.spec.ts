/**
 * Stage 2 – Role Integrity & Route Security Tests (INT-01 to INT-05)
 * Verifies role isolation, API protection, unauthorized case access prevention,
 * and exclusion of deactivated therapists from assignment dropdowns.
 */
import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";

const USERS = {
  admin: {
    email: process.env.TEST_ADMIN_EMAIL ?? "test.admin@guildclub.com",
    password: process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin@123",
  },
  therapist: {
    email: process.env.TEST_THERAPIST_EMAIL ?? "test.therapist@guildclub.com",
    password: process.env.TEST_THERAPIST_PASSWORD ?? "TestTherapist@123",
  },
};

test.describe("INT: Role Integrity & Security", () => {
  test("INT-01: Therapist cannot access /admin/cases (redirected away)", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', USERS.therapist.email);
    await page.fill('[data-testid="login-password-input"]', USERS.therapist.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    // Attempt unauthorized access to admin cases
    await page.goto("/admin/cases");
    // Should be redirected back to therapist dashboard or denied
    await expect(page).not.toHaveURL(/\/admin\/cases$/);
    await expect(page).toHaveURL(/\/(therapist\/dashboard|login)/);
  });

  test("INT-02: Admin cannot access /super-admin/admins (redirected away)", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', USERS.admin.email);
    await page.fill('[data-testid="login-password-input"]', USERS.admin.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Attempt unauthorized access to super-admin admins
    await page.goto("/super-admin/admins");
    await expect(page).not.toHaveURL(/\/super-admin\/admins$/);
    await expect(page).toHaveURL(/\/(admin\/dashboard|login)/);
  });

  test("INT-03: Direct unauthenticated HTTP API calls to Stage 2 routes return 401", async ({ request }) => {
    const dummyId = "00000000-0000-0000-0000-000000000000";

    const endpoints = [
      { method: "get", path: "/api/super-admin/admins" },
      { method: "post", path: "/api/super-admin/admins" },
      { method: "get", path: "/api/admin/therapists" },
      { method: "post", path: "/api/admin/therapists" },
      { method: "get", path: "/api/admin/cases" },
      { method: "post", path: "/api/admin/cases" },
      { method: "post", path: `/api/admin/cases/${dummyId}/assign` },
      { method: "get", path: `/api/therapist/cases/${dummyId}` },
      { method: "post", path: `/api/therapist/cases/${dummyId}/status` },
      { method: "post", path: `/api/therapist/cases/${dummyId}/notes` },
      { method: "post", path: `/api/therapist/cases/${dummyId}/sessions` },
      { method: "post", path: `/api/therapist/cases/${dummyId}/close` },
    ];

    for (const ep of endpoints) {
      const res =
        ep.method === "get"
          ? await request.get(ep.path)
          : await request.post(ep.path, { data: {} });
      expect(
        res.status(),
        `Expected 401 for unauthenticated ${ep.method.toUpperCase()} ${ep.path}`
      ).toBe(401);
    }
  });

  test("INT-04: Therapist cannot view a case not assigned to them", async ({ page }) => {
    const sql = neon(assertTestDatabase());

    // 1. Log in as therapist
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', USERS.therapist.email);
    await page.fill('[data-testid="login-password-input"]', USERS.therapist.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    // 2. Find a case where current_therapist_id is NULL or different
    const thRows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [USERS.therapist.email]);
    const therapistId = thRows[0]["id"] as string;

    const unassignedCases = await sql.query(
      "SELECT id FROM cases WHERE current_therapist_id IS NULL OR current_therapist_id != $1 LIMIT 1",
      [therapistId]
    );

    let unassignedCaseId: string;
    if (unassignedCases.length === 0) {
      const admin = await sql.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const adminId = admin[0]["id"] as string;
      const client = await sql.query(
        `INSERT INTO clients (full_name, email, phone, age, gender)
         VALUES ('Integrity Client', 'integrity.client@test.com', '+91 9888800002', 29, 'Male')
         RETURNING id`
      );
      const curYear = new Date().getFullYear();
      const newCase = await sql.query(
        `INSERT INTO cases (case_number, client_id, category, priority, status, description, created_by)
         VALUES ($1, $2, 'Individual Therapy', 'medium', 'new', 'Integrity test case', $3)
         RETURNING id`,
        [`GCS-${curYear}-6666`, client[0]["id"], adminId]
      );
      unassignedCaseId = newCase[0]["id"] as string;
    } else {
      unassignedCaseId = unassignedCases[0]["id"] as string;
    }

    // 3. Attempt to access unassigned case page
    await page.goto(`/therapist/cases/${unassignedCaseId}`);

    // TherapistCaseDetailPage redirects to /therapist/dashboard if case is not assigned to current therapist
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 10000 });
  });

  test("INT-05: Deactivated therapist does not appear in case assignment dropdown", async ({ page }) => {
    const sql = neon(assertTestDatabase());

    // Ensure there is a deactivated therapist
    let deactivated = await sql.query(
      "SELECT id, name FROM users WHERE role = 'therapist' AND is_active = false LIMIT 1"
    );

    if (deactivated.length === 0) {
      await sql.query(
        `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
         VALUES ('Inactive QA Therapist', 'inactive.qa@guildclubtest.com', '$2a$10$abcdefghijklmnopqrstuu', 'therapist', false, false)
         ON CONFLICT (email) DO UPDATE SET is_active = false`
      );
      deactivated = await sql.query(
        "SELECT id, name FROM users WHERE email = 'inactive.qa@guildclubtest.com' LIMIT 1"
      );
    }

    const deactivatedName = deactivated[0]["name"] as string;

    // Log in as admin
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', USERS.admin.email);
    await page.fill('[data-testid="login-password-input"]', USERS.admin.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Ensure there is at least one case to view assignment dropdown
    let caseRows = await sql.query("SELECT id FROM cases WHERE status = 'new' LIMIT 1");
    if (caseRows.length === 0) {
      const admin = await sql.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      const adminId = admin[0]["id"] as string;
      const client = await sql.query(
        `INSERT INTO clients (full_name, email, phone, age, gender)
         VALUES ('Integrity Client 2', 'integrity.client2@test.com', '+91 9888800003', 35, 'Female')
         RETURNING id`
      );
      const curYear = new Date().getFullYear();
      caseRows = await sql.query(
        `INSERT INTO cases (case_number, client_id, category, priority, status, description, created_by)
         VALUES ($1, $2, 'Individual Therapy', 'low', 'new', 'Integrity test case 2', $3)
         RETURNING id`,
        [`GCS-${curYear}-5555`, client[0]["id"], adminId]
      );
    }

    await page.goto(`/admin/cases/${caseRows[0]["id"]}`);
    const select = page.getByTestId("assign-therapist-select");
    await expect(select).toBeVisible({ timeout: 10000 });

    const optionTexts = await select.locator("option").allInnerTexts();
    const containsDeactivated = optionTexts.some((text) => text.includes(deactivatedName));
    expect(
      containsDeactivated,
      `Deactivated therapist '${deactivatedName}' must not appear in assignment dropdown`
    ).toBe(false);
  });
});
