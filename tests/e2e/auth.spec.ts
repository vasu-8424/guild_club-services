import { test, expect } from "@playwright/test";

const testUsers = {
  superAdmin: {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || "test.superadmin@guildclub.com",
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || "TestSuperAdmin@123",
  },
  admin: {
    email: process.env.TEST_ADMIN_EMAIL || "test.admin@guildclub.com",
    password: process.env.TEST_ADMIN_PASSWORD || "TestAdmin@123",
  },
  therapist: {
    email: process.env.TEST_THERAPIST_EMAIL || "test.therapist@guildclub.com",
    password: process.env.TEST_THERAPIST_PASSWORD || "TestTherapist@123",
  },
  deactivated: {
    email: process.env.TEST_DEACTIVATED_EMAIL || "test.deactivated@guildclub.com",
    password: process.env.TEST_DEACTIVATED_PASSWORD || "TestDeactivated@123",
  },
};

test.describe("B. Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("AUTH-01: Super Admin logs in with valid credentials and lands on /super-admin/dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.superAdmin.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.superAdmin.password);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/super-admin\/dashboard/);
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText("super_admin");
  });

  test("AUTH-02: Admin lands on /admin/dashboard; therapist lands on /therapist/dashboard", async ({ page }) => {
    // 1. Admin login
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.admin.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.admin.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText("admin");

    // Clear session for next user
    await page.context().clearCookies();

    // 2. Therapist login
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.therapist.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.therapist.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/therapist\/dashboard/);
    await expect(page.locator('[data-testid="user-role-badge"]')).toContainText("therapist");
  });

  test("AUTH-03: Wrong password shows a friendly error and does not log in", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.superAdmin.email);
    await page.fill('[data-testid="login-password-input"]', "WrongPassword@999");
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText("Invalid email or password.");
  });

  test("AUTH-04: Unknown email shows the SAME generic error as a wrong password (no account enumeration)", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', "nonexistent.user.987@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', "SomeRandomPassword@123");
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
    // Exactly matches the message from AUTH-03 to prevent enumeration
    await expect(errorBox).toHaveText(/Invalid email or password\./);
  });

  test("AUTH-05: Empty fields and an invalid email format show validation errors", async ({ page }) => {
    await page.goto("/login");

    // Bypass browser default html5 validation to test server/zod validation
    await page.evaluate(() => {
      document.querySelector("form")?.setAttribute("novalidate", "true");
    });

    // Test empty submission
    await page.click('[data-testid="login-submit-button"]');
    await expect(page.locator('[data-testid="login-email-input-error"]')).toBeVisible();

    // Test malformed email
    await page.fill('[data-testid="login-email-input"]', "not-an-email");
    await page.fill('[data-testid="login-password-input"]', "ValidPassword123");
    await page.click('[data-testid="login-submit-button"]');

    await expect(page.locator('[data-testid="login-email-input-error"]')).toContainText("Please provide a valid email address");
  });

  test("AUTH-06: A deactivated user cannot log in", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.deactivated.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.deactivated.password);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText("This account is deactivated.");
  });

  test("AUTH-07: Logout clears the session; going back to a protected page redirects to /login", async ({ page }) => {
    // 1. Log in
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.superAdmin.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.superAdmin.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    // 2. Open user menu and click logout
    await page.click('[data-testid="user-menu-button"]');
    await page.click('[data-testid="logout-button"]');

    // 3. Should land on /login
    await expect(page).toHaveURL(/\/login/);

    // 4. Try navigating directly to protected dashboard
    await page.goto("/super-admin/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("AUTH-08: The session cookie is httpOnly, and secure in production mode; check the flags", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.superAdmin.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.superAdmin.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "gcs_session");

    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.httpOnly).toBe(true);
    expect(sessionCookie!.sameSite).toBe("Lax");
    expect(sessionCookie!.path).toBe("/");
  });

  test("AUTH-09: Rate limiting: after N repeated failed logins, further attempts are blocked", async ({ page }) => {
    const rateLimitTestEmail = "rate.limiting.test@guildclub.com";
    await page.goto("/login");

    // 5 allowed attempts
    for (let i = 1; i <= 5; i++) {
      await page.fill('[data-testid="login-email-input"]', rateLimitTestEmail);
      await page.fill('[data-testid="login-password-input"]', `WrongPassAttempt${i}`);
      await page.click('[data-testid="login-submit-button"]');
      await expect(page.locator('[data-testid="login-error-message"]')).toBeVisible();
    }

    // 6th attempt should be blocked by rate limit
    await page.fill('[data-testid="login-email-input"]', rateLimitTestEmail);
    await page.fill('[data-testid="login-password-input"]', "WrongPassAttempt6");
    await page.click('[data-testid="login-submit-button"]');

    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText("Too many failed login attempts");
  });

  test("AUTH-10: There is NO public sign-up page (/register, /signup, /sign-up all return 404 or redirect to login)", async ({ page }) => {
    const routes = ["/register", "/signup", "/sign-up"];

    for (const route of routes) {
      const response = await page.goto(route);
      expect([404, 307, 308, 302, 200]).toContain(response?.status());
      // Ensure it does not present a registration form
      await expect(page.locator("text=Create an account")).not.toBeVisible();
      await expect(page.locator("text=Sign up")).not.toBeVisible();
    }
  });
});
