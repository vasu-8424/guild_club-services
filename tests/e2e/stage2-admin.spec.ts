/**
 * Stage 2 – Admin Management Tests (ADM-01 to ADM-09)
 * Super Admin can create, edit, activate/deactivate Admin accounts with manual credentials.
 */
import { test, expect } from "@playwright/test";
import { getLatestEmail } from "../helpers/stage2-helpers";

const SA = {
  email: process.env.TEST_SUPER_ADMIN_EMAIL ?? "test.superadmin@guildclub.com",
  password: process.env.TEST_SUPER_ADMIN_PASSWORD ?? "TestSuperAdmin@123",
};

const newAdmin = {
  name: "QA Admin User",
  email: "qa.admin@guildclubtest.com",
  phone: "+91 9800000099",
  password: "AdminPassword@123",
};

async function loginAsSuperAdmin(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', SA.email);
  await page.fill('[data-testid="login-password-input"]', SA.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });
}

test.describe("ADM: Super Admin – Admin Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test("ADM-01: Super admin can navigate to /super-admin/admins and see the admins list", async ({ page }) => {
    await page.goto("/super-admin/admins");
    await expect(page).toHaveURL(/\/super-admin\/admins/);
    await expect(page.locator("h1").first()).toContainText(/administrator|admin/i);
  });

  test("ADM-02: Super admin can open the Create Admin form at /super-admin/admins/new", async ({ page }) => {
    await page.goto("/super-admin/admins/new");
    await expect(page.getByTestId("admin-name-input")).toBeVisible();
    await expect(page.getByTestId("admin-email-input")).toBeVisible();
    await expect(page.getByTestId("admin-password-input")).toBeVisible();
  });

  test("ADM-03: Creating an admin with typed password shows one-time copy dialog and sends NO credentials email", async ({ page }) => {
    await page.goto("/super-admin/admins/new");
    await page.getByTestId("admin-name-input").fill(newAdmin.name);
    await page.getByTestId("admin-email-input").fill(newAdmin.email);
    await page.getByTestId("admin-phone-input").fill(newAdmin.phone);
    await page.getByTestId("admin-password-input").fill(newAdmin.password);
    await page.getByTestId("admin-confirm-password-input").fill(newAdmin.password);
    await page.locator('[data-testid="admin-submit-button"]').click();

    // The one-time credentials modal displays the credentials and copy button
    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("credentials-email")).toContainText(newAdmin.email);
    await expect(page.getByTestId("credentials-password")).toContainText(newAdmin.password);
    await page.getByTestId("done-button").click();
    await expect(page).toHaveURL(/\/super-admin\/admins/, { timeout: 15000 });

    // NO credentials email queued in DB!
    const email = await getLatestEmail(newAdmin.email, "admin_credentials" as any);
    expect(email, "No admin_credentials email should ever be queued").toBeNull();
  });

  test("ADM-04: Creating admin records an admin_created event", async ({ page }) => {
    const { neon } = await import("@neondatabase/serverless");
    const { assertTestDatabase } = await import("../helpers/seed-test-data");
    const sql = neon(assertTestDatabase());
    const rows = await sql.query(
      "SELECT * FROM case_events WHERE event_type = 'admin_created' ORDER BY occurred_at DESC LIMIT 1"
    );
    expect(rows.length).toBeGreaterThan(0);
    void page;
  });

  test("ADM-05: Newly created admin logs in directly to /admin/dashboard with NO password change prompt", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', newAdmin.email);
    await page.fill('[data-testid="login-password-input"]', newAdmin.password);
    await page.click('[data-testid="login-submit-button"]');

    // Lands directly on /admin/dashboard with NO prompt!
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/change-password/);
  });

  test("ADM-06: Super admin can view and edit admin details at /super-admin/admins/[id]", async ({ page }) => {
    await page.goto("/super-admin/admins");

    const firstLink = page.locator('tbody tr a:has-text("Edit"), [data-testid="admin-list-item"]').first();
    if (await firstLink.isVisible()) {
      await firstLink.click();
    } else {
      const { neon } = await import("@neondatabase/serverless");
      const { assertTestDatabase } = await import("../helpers/seed-test-data");
      const sql = neon(assertTestDatabase());
      const rows = await sql.query("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at DESC LIMIT 1");
      if (rows.length > 0) {
        await page.goto(`/super-admin/admins/${rows[0]["id"]}`);
      }
    }

    const nameInput = page.locator('[data-testid="admin-edit-name-input"], [data-testid="edit-admin-name-input"]').first();
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill("QA Admin Edited");
    await page.locator('[data-testid="admin-edit-submit-button"], [data-testid="edit-admin-submit"]').first().click();
    await expect(page.locator("[data-testid='admin-edit-success-message'], [data-testid='edit-admin-success']").first()).toBeVisible({ timeout: 10000 });
  });

  test("ADM-07: Super admin can deactivate an admin account", async ({ page }) => {
    const { neon } = await import("@neondatabase/serverless");
    const { assertTestDatabase } = await import("../helpers/seed-test-data");
    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [newAdmin.email]);
    if (rows.length === 0) {
      test.skip();
      return;
    }

    await page.goto(`/super-admin/admins/${rows[0]["id"]}`);
    page.once("dialog", (dialog) => dialog.accept());
    const toggleBtn = page.getByTestId("admin-toggle-status-button");
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
    await toggleBtn.click();
    await expect(page.getByTestId("admin-edit-success-message")).toBeVisible({ timeout: 10000 });
  });

  test("ADM-08: Deactivated admin cannot log in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', newAdmin.email);
    await page.fill('[data-testid="login-password-input"]', newAdmin.password);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page.getByTestId("login-error-message")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("ADM-09: Super admin can reactivate the admin account", async ({ page }) => {
    const { neon } = await import("@neondatabase/serverless");
    const { assertTestDatabase } = await import("../helpers/seed-test-data");
    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [newAdmin.email]);
    if (rows.length === 0) {
      test.skip();
      return;
    }

    await page.goto(`/super-admin/admins/${rows[0]["id"]}`);
    page.once("dialog", (dialog) => dialog.accept());
    const toggleBtn = page.getByTestId("admin-toggle-status-button");
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
    await toggleBtn.click();
    await expect(page.getByTestId("admin-edit-success-message")).toBeVisible({ timeout: 10000 });
  });
});
