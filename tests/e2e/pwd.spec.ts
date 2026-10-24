import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";

const testTherapistForce = {
  email:
    process.env.TEST_THERAPIST_FORCE_PWD_EMAIL ||
    "test.therapist.force@guildclub.com",
  oldPassword:
    process.env.TEST_THERAPIST_FORCE_PWD_PASSWORD || "TestTherapistForce@123",
  newPassword: "BrandNewSecurePassword@2026",
};

test.describe("C. Forced Password Change", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("PWD-01: A user with must_change_password = true is redirected to /change-password after login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testTherapistForce.email);
    await page.fill('[data-testid="login-password-input"]', testTherapistForce.oldPassword);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/change-password/);
    await expect(page.locator("h1")).toContainText("Password Change Required");
  });

  test("PWD-02: That user cannot open any dashboard URL directly until password is changed", async ({ page }) => {
    // 1. Log in to acquire session with mustChangePassword=true
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testTherapistForce.email);
    await page.fill('[data-testid="login-password-input"]', testTherapistForce.oldPassword);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/change-password/);

    // 2. Try navigating directly to therapist dashboard
    await page.goto("/therapist/dashboard");
    await expect(page).toHaveURL(/\/change-password/);

    // 3. Try navigating directly to root or other paths
    await page.goto("/");
    await expect(page).toHaveURL(/\/change-password/);
  });

  test("PWD-03: Changing password with weak or mismatched input shows validation errors", async ({ page }) => {
    // Log in to reach /change-password
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testTherapistForce.email);
    await page.fill('[data-testid="login-password-input"]', testTherapistForce.oldPassword);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/change-password/);

    // Mismatched passwords
    await page.fill('[data-testid="current-password-input"]', testTherapistForce.oldPassword);
    await page.fill('[data-testid="new-password-input"]', "ValidPassword123!");
    await page.fill('[data-testid="confirm-password-input"]', "DifferentPassword123!");
    await page.click('[data-testid="change-password-submit-button"]');

    await expect(page.locator('[data-testid="confirm-password-input-error"]')).toContainText(
      "Passwords do not match"
    );

    // Short password (< 8 chars)
    await page.fill('[data-testid="new-password-input"]', "Short1!");
    await page.fill('[data-testid="confirm-password-input"]', "Short1!");
    await page.click('[data-testid="change-password-submit-button"]');

    await expect(page.locator('[data-testid="new-password-input-error"]')).toContainText(
      "must be at least 8 characters long"
    );
  });

  test("PWD-04: A valid password change works, must_change_password becomes false (verify in DB), and user reaches dashboard", async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testTherapistForce.email);
    await page.fill('[data-testid="login-password-input"]', testTherapistForce.oldPassword);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/change-password/);

    // Enter valid new password
    await page.fill('[data-testid="current-password-input"]', testTherapistForce.oldPassword);
    await page.fill('[data-testid="new-password-input"]', testTherapistForce.newPassword);
    await page.fill('[data-testid="confirm-password-input"]', testTherapistForce.newPassword);
    await page.click('[data-testid="change-password-submit-button"]');

    // Should successfully navigate to /therapist/dashboard
    await expect(page).toHaveURL(/\/therapist\/dashboard/);

    // Verify in database that must_change_password is now false
    const sql = neon(assertTestDatabase());
    const rows = await sql`
      SELECT email, must_change_password
      FROM users
      WHERE email = ${testTherapistForce.email}
    `;

    expect(rows.length).toBe(1);
    expect(rows[0].must_change_password).toBe(false);
  });

  test("PWD-05: The new password works on the next login, and the old one does not", async ({ page }) => {
    // 1. Old password should fail
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testTherapistForce.email);
    await page.fill('[data-testid="login-password-input"]', testTherapistForce.oldPassword);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-testid="login-error-message"]')).toContainText(
      "Invalid email or password."
    );

    // 2. New password should succeed directly to dashboard
    await page.fill('[data-testid="login-email-input"]', testTherapistForce.email);
    await page.fill('[data-testid="login-password-input"]', testTherapistForce.newPassword);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/therapist\/dashboard/);
  });
});
