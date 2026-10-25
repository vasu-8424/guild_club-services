import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";
import { getLatestEmail } from "../helpers/stage2-helpers";

const SA = {
  email: process.env.TEST_SUPER_ADMIN_EMAIL ?? "test.superadmin@guildclub.com",
  password: process.env.TEST_SUPER_ADMIN_PASSWORD ?? "TestSuperAdmin@123",
};

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? "test.admin@guildclub.com",
  password: process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin@123",
};

const THERAPIST = {
  email: process.env.TEST_THERAPIST_EMAIL ?? "test.therapist@guildclub.com",
  password: process.env.TEST_THERAPIST_PASSWORD ?? "TestTherapist@123",
};

test.describe("NEW CREDENTIAL RULES & LIFECYCLE", () => {
  const ts = Date.now();
  const testAdmin = {
    name: "Cred Admin",
    email: `cred.admin.${ts}@guildclubtest.com`,
    phone: "+91 9988776655",
    password: "StrongAdminPassword@123",
  };

  const testTherapist = {
    name: "Cred Therapist",
    email: `cred.therapist.${ts}@guildclubtest.com`,
    phone: "+91 9988776656",
    specialization: "Clinical Trauma & CBT",
    experienceYears: "5",
    maxOpenCases: "8",
    password: "StrongTherapistPassword@123",
  };

  test("1. Super Admin creates an admin with typed password; admin logs in directly with no password-change prompt", async ({ page }) => {
    // Super Admin signs in
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SA.email);
    await page.fill('[data-testid="login-password-input"]', SA.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });

    // Navigate to Add Admin
    await page.goto("/super-admin/admins/new");
    await page.getByTestId("admin-name-input").fill(testAdmin.name);
    await page.getByTestId("admin-email-input").fill(testAdmin.email);
    await page.getByTestId("admin-phone-input").fill(testAdmin.phone);
    await page.getByTestId("admin-password-input").fill(testAdmin.password);
    await page.getByTestId("admin-confirm-password-input").fill(testAdmin.password);
    await page.getByTestId("admin-submit-button").click();

    // Verify one-time credentials dialog
    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("credentials-email")).toContainText(testAdmin.email);
    await expect(page.getByTestId("credentials-password")).toContainText(testAdmin.password);
    await page.getByTestId("done-button").click();
    await expect(page).toHaveURL(/\/super-admin\/admins/);

    // New Admin logs in
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testAdmin.email);
    await page.fill('[data-testid="login-password-input"]', testAdmin.password);
    await page.click('[data-testid="login-submit-button"]');

    // Lands straight on /admin/dashboard with NO password change prompt
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/change-password/);
  });

  test("2. Admin creates a therapist; therapist logs in directly to /therapist/dashboard", async ({ page }) => {
    // Admin signs in
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Register Therapist
    await page.goto("/admin/therapists/new");
    await page.getByTestId("therapist-name-input").fill(testTherapist.name);
    await page.getByTestId("therapist-email-input").fill(testTherapist.email);
    await page.getByTestId("therapist-phone-input").fill(testTherapist.phone);
    await page.getByTestId("therapist-specialization-input").fill(testTherapist.specialization);
    await page.getByTestId("therapist-experience-input").fill(testTherapist.experienceYears);
    await page.getByTestId("therapist-max-cases-input").fill(testTherapist.maxOpenCases);
    await page.getByTestId("therapist-password-input").fill(testTherapist.password);
    await page.getByTestId("therapist-confirm-password-input").fill(testTherapist.password);
    await page.getByTestId("therapist-submit-button").click();

    // Verify one-time credentials dialog
    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("credentials-email")).toContainText(testTherapist.email);
    await expect(page.getByTestId("credentials-password")).toContainText(testTherapist.password);
    await page.getByTestId("done-button").click();
    await expect(page).toHaveURL(/\/admin\/therapists/);

    // New Therapist logs in
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testTherapist.email);
    await page.fill('[data-testid="login-password-input"]', testTherapist.password);
    await page.click('[data-testid="login-submit-button"]');

    // Lands straight on /therapist/dashboard
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/change-password/);
  });

  test("3. No credentials email appears in email_queue", async () => {
    const adminEmail = await getLatestEmail(testAdmin.email, "admin_credentials" as any);
    expect(adminEmail, "No admin_credentials email should ever be queued").toBeNull();

    const therapistEmail = await getLatestEmail(testTherapist.email, "therapist_credentials" as any);
    expect(therapistEmail, "No therapist_credentials email should ever be queued").toBeNull();
  });

  test("4. Duplicate email is rejected; weak password is rejected", async ({ page }) => {
    // Login as Super Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SA.email);
    await page.fill('[data-testid="login-password-input"]', SA.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });

    // Test duplicate email (using seeded active ADMIN.email)
    await page.goto("/super-admin/admins/new");
    await page.getByTestId("admin-name-input").fill("Duplicate User");
    await page.getByTestId("admin-email-input").fill(ADMIN.email);
    await page.getByTestId("admin-password-input").fill("StrongPassword@123");
    await page.getByTestId("admin-confirm-password-input").fill("StrongPassword@123");
    await page.getByTestId("admin-submit-button").click();

    await expect(page.getByTestId("admin-error-message")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("admin-error-message")).toContainText(/already exists/i);

    // Test weak password (< 8 chars, or missing numbers/letters)
    await page.getByTestId("admin-email-input").fill(`unique.${Date.now()}@guildclubtest.com`);
    await page.getByTestId("admin-password-input").fill("weak");
    await page.getByTestId("admin-confirm-password-input").fill("weak");
    await page.getByTestId("admin-submit-button").click();

    await expect(page.getByTestId("admin-error-message")).toBeVisible();
    await expect(page.getByTestId("admin-error-message")).toContainText(/at least 8 characters/i);
  });

  test("5. Reset password: old password stops working, new one works, old session is kicked out", async ({ browser }) => {
    test.setTimeout(90000);
    const resetEmail = `reset.admin.${Date.now()}@guildclubtest.com`;
    const origPassword = "OriginalPassword@123";
    const newResetPassword = "BrandNewPassword@789";

    const sql = neon(assertTestDatabase());
    const bcrypt = await import("bcryptjs");
    const origHash = await bcrypt.hash(origPassword, 10);
    const [inserted] = await sql.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password, session_version)
       VALUES ('Reset Test Admin', $1, $2, 'admin', true, false, 1) RETURNING id`,
      [resetEmail, origHash]
    );
    const adminId = inserted["id"] as string;

    // Create dedicated context for the admin user session
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    // Log in as resetAdmin with original password
    await adminPage.goto("/login");
    await adminPage.fill('[data-testid="login-email-input"]', resetEmail);
    await adminPage.fill('[data-testid="login-password-input"]', origPassword);
    await adminPage.click('[data-testid="login-submit-button"]');
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // In super admin context, reset the admin's password
    const saContext = await browser.newContext();
    const saPage = await saContext.newPage();
    await saPage.goto("/login");
    await saPage.fill('[data-testid="login-email-input"]', SA.email);
    await saPage.fill('[data-testid="login-password-input"]', SA.password);
    await saPage.click('[data-testid="login-submit-button"]');
    await expect(saPage).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });

    await saPage.goto("/super-admin/admins");
    const kebabBtn = saPage.getByTestId(`row-actions-kebab-${adminId}`);
    if (await kebabBtn.isVisible()) {
      await kebabBtn.click();
    }
    const resetBtn = saPage.getByTestId(`reset-admin-pwd-${adminId}`);
    await expect(resetBtn).toBeVisible({ timeout: 10000 });
    await resetBtn.click();

    // Fill reset modal
    await saPage.getByTestId("reset-password-input").fill(newResetPassword);
    await saPage.getByTestId("reset-confirm-password-input").fill(newResetPassword);
    await saPage.getByTestId("confirm-reset-password-button").click();

    // Modal shows one-time credentials
    await expect(saPage.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await saPage.getByTestId("done-button").click();

    // Verify user_password_reset event recorded
    const eventRows = await sql.query(
      "SELECT * FROM case_events WHERE event_type = 'user_password_reset' AND target_user_id = $1",
      [adminId]
    );
    expect(eventRows.length).toBeGreaterThan(0);

    // Verify old session is invalidated on the next request!
    await adminPage.goto("/admin/dashboard");
    await expect(adminPage).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(adminPage).toHaveURL(/error=access_removed/);

    // Verify old password stops working
    await adminPage.fill('[data-testid="login-email-input"]', resetEmail);
    await adminPage.fill('[data-testid="login-password-input"]', origPassword);
    await adminPage.click('[data-testid="login-submit-button"]');
    await expect(adminPage.getByTestId("login-error-message")).toBeVisible();

    // Verify new password works
    await adminPage.fill('[data-testid="login-password-input"]', newResetPassword);
    await adminPage.click('[data-testid="login-submit-button"]');
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    await adminContext.close();
    await saContext.close();
  });

  test("6. Delete: user cannot log in, active session is rejected, name shows (deleted), and email can be reused", async ({ browser }) => {
    test.setTimeout(90000);
    // 1. Create a disposable user to delete
    const delEmail = `disposable.${Date.now()}@guildclubtest.com`;
    const delPassword = "DisposablePassword@123";

    const sql = neon(assertTestDatabase());
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash(delPassword, 10);
    const [inserted] = await sql.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password, session_version)
       VALUES ('Disposable Staff', $1, $2, 'admin', true, false, 1) RETURNING id`,
      [delEmail, hash]
    );
    const delId = inserted["id"] as string;

    // 2. Open active session for disposable user
    const userContext = await browser.newContext();
    const userPage = await userContext.newPage();
    await userPage.goto("/login");
    await userPage.fill('[data-testid="login-email-input"]', delEmail);
    await userPage.fill('[data-testid="login-password-input"]', delPassword);
    await userPage.click('[data-testid="login-submit-button"]');
    await expect(userPage).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 3. Super admin deletes the user
    const saContext = await browser.newContext();
    const saPage = await saContext.newPage();
    await saPage.goto("/login");
    await saPage.fill('[data-testid="login-email-input"]', SA.email);
    await saPage.fill('[data-testid="login-password-input"]', SA.password);
    await saPage.click('[data-testid="login-submit-button"]');
    await expect(saPage).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });

    await saPage.goto("/super-admin/admins");
    const kebabBtn = saPage.getByTestId(`row-actions-kebab-${delId}`);
    if (await kebabBtn.isVisible()) {
      await kebabBtn.click();
    }
    const deleteBtn = saPage.getByTestId(`delete-admin-btn-${delId}`);
    await expect(deleteBtn).toBeVisible({ timeout: 10000 });
    await deleteBtn.click();

    // Type email to confirm
    await saPage.getByTestId("delete-confirm-email-input").fill(delEmail);
    await saPage.getByTestId("confirm-delete-user-button").click();
    await expect(saPage.getByTestId("confirm-delete-user-button")).not.toBeVisible({ timeout: 15000 });

    // 4. Verify user_deleted event recorded in DB
    const delEventRows = await sql.query(
      "SELECT * FROM case_events WHERE event_type = 'user_deleted' AND target_user_id = $1",
      [delId]
    );
    expect(delEventRows.length).toBeGreaterThan(0);

    // 5. Active session is kicked out on next request
    await userPage.goto("/admin/dashboard");
    await expect(userPage).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(userPage).toHaveURL(/error=access_removed/);

    // 6. Deleted user cannot log in
    await userPage.fill('[data-testid="login-email-input"]', delEmail);
    await userPage.fill('[data-testid="login-password-input"]', delPassword);
    await userPage.click('[data-testid="login-submit-button"]');
    await expect(userPage.getByTestId("login-error-message")).toBeVisible();

    // 7. Toggle "Show deleted" and check name displays as "Name (deleted)"
    await saPage.goto("/super-admin/admins?showDeleted=true");
    const nameCell = saPage.getByTestId(`admin-name-${delId}`);
    await expect(nameCell).toBeVisible();
    await expect(nameCell).toContainText("(deleted)");

    // 8. Re-registering with the SAME email is allowed (partial unique index where deleted_at IS NULL)
    await saPage.goto("/super-admin/admins/new");
    await saPage.getByTestId("admin-name-input").fill("Reincarnated Staff");
    await saPage.getByTestId("admin-email-input").fill(delEmail);
    await saPage.getByTestId("admin-password-input").fill("BrandNewPassword@123");
    await saPage.getByTestId("admin-confirm-password-input").fill("BrandNewPassword@123");
    await saPage.getByTestId("admin-submit-button").click();

    await expect(saPage.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });

    await userContext.close();
    await saContext.close();
  });

  test("7. Therapist with an open case cannot be deleted; after reassigning, delete works", async ({ page }) => {
    const sql = neon(assertTestDatabase());

    // 1. Create a therapist and assign an open case
    const thEmail = `cased.therapist.${Date.now()}@guildclubtest.com`;
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.hash("Password@123", 10);

    const [tUser] = await sql.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, session_version)
       VALUES ('Dr. Active Case Therapist', $1, $2, 'therapist', true, 1) RETURNING id`,
      [thEmail, hash]
    );
    const tId = tUser["id"] as string;

    await sql.query(
      `INSERT INTO therapist_profiles (user_id, specialization, experience_years, max_open_cases)
       VALUES ($1, 'Clinical Psychology', 6, 10)`,
      [tId]
    );

    // Create client & open case assigned to this therapist
    const [client] = await sql.query(
      `INSERT INTO clients (full_name, age, gender, phone)
       VALUES ('Test Client Cases', 28, 'Female', '+91 9123456789') RETURNING id`
    );
    const clientId = client["id"] as string;

    const [adminUser] = await sql.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminUser["id"] as string;

    const caseNumber = `GCS-TEST-${Date.now().toString().slice(-4)}`;
    const [c] = await sql.query(
      `INSERT INTO cases (case_number, client_id, category, priority, description, status, created_by, current_therapist_id)
       VALUES ($1, $2, 'Individual Therapy', 'medium', 'Test case description', 'assigned', $3, $4) RETURNING id`,
      [caseNumber, clientId, adminId, tId]
    );
    const caseId = c["id"] as string;

    // Login as Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Try deleting therapist
    await page.goto("/admin/therapists");
    const kebabBtn = page.getByTestId(`row-actions-kebab-${tId}`);
    if (await kebabBtn.isVisible()) {
      await kebabBtn.click();
    }
    const delBtn = page.getByTestId(`delete-therapist-btn-${tId}`);
    await expect(delBtn).toBeVisible({ timeout: 10000 });
    await delBtn.click();

    // Verify modal warns about open cases and blocks deletion
    await expect(page.locator("body")).toContainText(/Cannot delete therapist with active cases/i, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(caseNumber);

    // Close modal
    await page.getByRole("button", { name: "Close" }).click();

    // Now reassign the case
    await sql.query("UPDATE cases SET current_therapist_id = NULL, status = 'new' WHERE id = $1", [caseId]);

    // Reopen delete modal
    if (await kebabBtn.isVisible()) {
      await kebabBtn.click();
    }
    await delBtn.click();

    // Now confirmation email input is available
    await expect(page.getByTestId("delete-confirm-email-input")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("delete-confirm-email-input").fill(thEmail);
    await page.getByTestId("confirm-delete-user-button").click();

    // Deletion succeeds!
    await expect(page.getByTestId("confirm-delete-user-button")).not.toBeVisible({ timeout: 15000 });
    await expect(delBtn).not.toBeVisible({ timeout: 15000 });
  });

  test("8. Admin cannot delete admins or Super Admin; nobody can delete themselves", async ({ page }) => {
    // 1. Admin attempts to call delete API on super admin -> rejected
    const sql = neon(assertTestDatabase());
    const [saUser] = await sql.query("SELECT id, email FROM users WHERE role = 'super_admin' LIMIT 1");
    const [adminUser] = await sql.query("SELECT id, email FROM users WHERE role = 'admin' LIMIT 1");

    // Login as Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // Try deleting Super Admin via API as Admin
    const delSaRes = await page.request.delete(`/api/super-admin/admins/${saUser["id"]}`, {
      data: { confirmEmail: saUser["email"] },
    });
    expect(delSaRes.status()).toBe(403);

    // Try deleting self via therapist API as Admin
    const delSelfRes = await page.request.delete(`/api/admin/therapists/${adminUser["id"]}`, {
      data: { confirmEmail: adminUser["email"] },
    });
    expect([400, 403]).toContain(delSelfRes.status());
  });

  test("9. API-level checks that wrong roles get 403 on create, reset, and delete", async ({ page }) => {
    // Login as therapist (role with least privilege)
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', THERAPIST.email);
    await page.fill('[data-testid="login-password-input"]', THERAPIST.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    // 1. Therapist cannot create an admin -> 403
    const createAdminRes = await page.request.post("/api/super-admin/admins", {
      data: {
        name: "Hacker Admin",
        email: "hacker@guildclubtest.com",
        password: "Password@123",
        confirmPassword: "Password@123",
      },
    });
    expect(createAdminRes.status()).toBe(403);

    // 2. Therapist cannot create a therapist -> 403
    const createThRes = await page.request.post("/api/admin/therapists", {
      data: {
        name: "Hacker Therapist",
        email: "hacker.th@guildclubtest.com",
        phone: "+91 9999999999",
        specialization: "None",
        experienceYears: 1,
        maxOpenCases: 5,
        password: "Password@123",
        confirmPassword: "Password@123",
      },
    });
    expect(createThRes.status()).toBe(403);

    // 3. Therapist cannot reset another user's password -> 403
    const resetRes = await page.request.post(`/api/admin/therapists/00000000-0000-0000-0000-000000000001/reset-password`, {
      data: { password: "Password@123", confirmPassword: "Password@123" },
    });
    expect(resetRes.status()).toBe(403);

    // 4. Therapist cannot delete another therapist -> 403
    const deleteRes = await page.request.delete(`/api/admin/therapists/00000000-0000-0000-0000-000000000001`, {
      data: { confirmEmail: "someone@guildclub.com" },
    });
    expect(deleteRes.status()).toBe(403);

    // 5. Admin cannot reset super admin or admin password via super-admin API -> 403
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    const adminResetSaRes = await page.request.post(`/api/super-admin/admins/00000000-0000-0000-0000-000000000001/reset-password`, {
      data: { password: "Password@123", confirmPassword: "Password@123" },
    });
    expect(adminResetSaRes.status()).toBe(403);
  });
});
