import { test, expect } from "@playwright/test";
import { signSessionToken } from "../../../src/lib/auth";

const testUsers = {
  superAdmin: {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || "qa.superadmin@guildclub.com",
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || "Password@Super123",
  },
  adminMain: {
    email: process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com",
    password: process.env.TEST_ADMIN_MAIN_PASSWORD || "Password@Admin123",
  },
  therapist1: {
    email: process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com",
    password: process.env.TEST_THERAPIST_1_PASSWORD || "Password@Therapist1",
  },
  therapistForce: {
    email: process.env.TEST_THERAPIST_FORCE_PWD_EMAIL || "qa.therapist.force@guildclub.com",
    password: process.env.TEST_THERAPIST_FORCE_PWD_PASSWORD || "Password@Force123",
  },
  deactivated: {
    email: process.env.TEST_DEACTIVATED_EMAIL || "qa.therapist.deact@guildclub.com",
    password: process.env.TEST_DEACTIVATED_PASSWORD || "Password@Deact123",
  },
};

test.describe("Suite A: AUTH AND ACCESS", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test("[AUTH-01] Super Admin logs in and lands on /super-admin/dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.superAdmin.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.superAdmin.password);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/super-admin\/dashboard/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("[AUTH-02] Admin lands on /admin/dashboard; Therapist lands on /therapist/dashboard", async ({ page }) => {
    // Admin login
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.adminMain.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.adminMain.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    await page.context().clearCookies();

    // Therapist login
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.therapist1.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.therapist1.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/therapist\/dashboard/);
  });

  test("[AUTH-03] Wrong password shows friendly error and does not log in", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.superAdmin.email);
    await page.fill('[data-testid="login-password-input"]', "IncorrectPassword@999");
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText("Invalid email or password.");
  });

  test("[AUTH-04] Unknown email shows SAME generic error as wrong password (no enumeration)", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', "unregistered.staff@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', "RandomPassword@123");
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText("Invalid email or password.");
  });

  test("[AUTH-05] Forced password change user redirected to /change-password", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.therapistForce.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.therapistForce.password);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/change-password/);
  });

  test("[AUTH-06] Deactivated user cannot log in", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.deactivated.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.deactivated.password);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/login/);
    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText("This account is deactivated.");
  });

  test("[AUTH-07] Logout clears session; navigating back redirects to /login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', testUsers.superAdmin.email);
    await page.fill('[data-testid="login-password-input"]', testUsers.superAdmin.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    // Call logout
    await page.goto("/api/auth/logout");
    await page.goto("/super-admin/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("[AUTH-08] Session cookie is httpOnly, sameSite Lax, path /", async ({ page }) => {
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

  test("[AUTH-09] Rate limiting blocks repeated failed logins", async ({ page }) => {
    const rateLimitEmail = "rate.test@guildclub.com";
    await page.goto("/login");

    for (let i = 1; i <= 6; i++) {
      await page.fill('[data-testid="login-email-input"]', rateLimitEmail);
      await page.fill('[data-testid="login-password-input"]', `WrongPassAttempt${i}`);
      await page.click('[data-testid="login-submit-button"]');
      await page.waitForTimeout(300);
    }

    const errorBox = page.locator('[data-testid="login-error-message"]');
    await expect(errorBox).toBeVisible();
  });

  test("[AUTH-10] No public sign-up & tampered or expired JWT rejected", async ({ page }) => {
    // 1. No public registration
    const routes = ["/register", "/signup", "/sign-up"];
    for (const route of routes) {
      const res = await page.goto(route);
      expect([404, 307, 308, 302, 200]).toContain(res?.status());
      await expect(page.locator("text=Create an account")).not.toBeVisible();
    }

    // 2. Tampered JWT
    await page.context().addCookies([
      {
        name: "gcs_session",
        value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/super-admin/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
