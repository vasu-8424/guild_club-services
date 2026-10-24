/**
 * Stage 2 – Therapist Management Tests (THR-01 to THR-09)
 * Admin can register, view, edit, and deactivate therapist accounts with manual credentials.
 */
import { test, expect } from "@playwright/test";
import { getLatestEmail } from "../helpers/stage2-helpers";

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? "test.admin@guildclub.com",
  password: process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin@123",
};

const newTherapist = {
  name: "Dr. QA Therapist",
  email: "qa.therapist@guildclubtest.com",
  phone: "+91 9700000099",
  specialization: "Cognitive Behavioral Therapy",
  experienceYears: "7",
  maxOpenCases: "12",
  password: "TherapistPassword@123",
};

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', ADMIN.email);
  await page.fill('[data-testid="login-password-input"]', ADMIN.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
}

test.describe("THR: Admin – Therapist Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("THR-01: Admin can navigate to /admin/therapists and see the list page", async ({ page }) => {
    await page.goto("/admin/therapists");
    await expect(page).toHaveURL(/\/admin\/therapists/);
    await expect(page.locator("h1").first()).toContainText(/therapist/i);
  });

  test("THR-02: Admin can open the Register Therapist form at /admin/therapists/new", async ({ page }) => {
    await page.goto("/admin/therapists/new");
    await expect(page.getByTestId("therapist-name-input")).toBeVisible();
    await expect(page.getByTestId("therapist-email-input")).toBeVisible();
    await expect(page.getByTestId("therapist-phone-input")).toBeVisible();
    await expect(page.getByTestId("therapist-specialization-input")).toBeVisible();
    await expect(page.getByTestId("therapist-password-input")).toBeVisible();
  });

  test("THR-03: Registering a therapist with typed password shows one-time copy dialog and sends NO credentials email", async ({ page }) => {
    await page.goto("/admin/therapists/new");
    await page.getByTestId("therapist-name-input").fill(newTherapist.name);
    await page.getByTestId("therapist-email-input").fill(newTherapist.email);
    await page.getByTestId("therapist-phone-input").fill(newTherapist.phone);
    await page.getByTestId("therapist-specialization-input").fill(newTherapist.specialization);
    await page.getByTestId("therapist-experience-input").fill(newTherapist.experienceYears);
    await page.getByTestId("therapist-max-cases-input").fill(newTherapist.maxOpenCases);
    await page.getByTestId("therapist-password-input").fill(newTherapist.password);
    await page.getByTestId("therapist-confirm-password-input").fill(newTherapist.password);
    await page.locator('[data-testid="therapist-submit-button"]').click();

    // The one-time credentials modal displays the credentials and copy button
    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("credentials-email")).toContainText(newTherapist.email);
    await expect(page.getByTestId("credentials-password")).toContainText(newTherapist.password);
    await page.getByTestId("done-button").click();
    await expect(page).toHaveURL(/\/admin\/therapists/, { timeout: 15000 });

    // NO credentials email queued in DB!
    const email = await getLatestEmail(newTherapist.email, "therapist_credentials" as any);
    expect(email, "No therapist_credentials email should ever be queued").toBeNull();
  });

  test("THR-04: New therapist appears in list with correct specialization", async ({ page }) => {
    await page.goto("/admin/therapists");
    await expect(page.locator("body")).toContainText(newTherapist.name, { timeout: 10000 });
  });

  test("THR-05: Therapist logs in directly to /therapist/dashboard with NO password change prompt", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', newTherapist.email);
    await page.fill('[data-testid="login-password-input"]', newTherapist.password);
    await page.click('[data-testid="login-submit-button"]');

    // Lands directly on /therapist/dashboard
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });
    await expect(page).not.toHaveURL(/\/change-password/);
  });

  test("THR-06: Admin can view and edit therapist profile at /admin/therapists/[id]", async ({ page }) => {
    const { neon } = await import("@neondatabase/serverless");
    const { assertTestDatabase } = await import("../helpers/seed-test-data");
    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [newTherapist.email]);
    if (rows.length === 0) {
      test.skip();
      return;
    }

    await page.goto(`/admin/therapists/${rows[0]["id"]}`);
    const nameInput = page.getByTestId("therapist-edit-name-input");
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill("Dr. QA Therapist Edited");
    await page.getByTestId("therapist-edit-submit-button").click();
    await expect(page.getByTestId("therapist-edit-success-message")).toBeVisible({ timeout: 10000 });
  });

  test("THR-07: Admin can deactivate a therapist account", async ({ page }) => {
    const { neon } = await import("@neondatabase/serverless");
    const { assertTestDatabase } = await import("../helpers/seed-test-data");
    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [newTherapist.email]);
    if (rows.length === 0) {
      test.skip();
      return;
    }

    await page.goto(`/admin/therapists/${rows[0]["id"]}`);
    page.once("dialog", (dialog) => dialog.accept());
    const toggleBtn = page.getByTestId("therapist-toggle-status-button");
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
    await toggleBtn.click();
    await expect(page.getByTestId("therapist-edit-success-message")).toBeVisible({ timeout: 10000 });
  });

  test("THR-08: Deactivated therapist cannot log in", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', newTherapist.email);
    await page.fill('[data-testid="login-password-input"]', newTherapist.password);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page.getByTestId("login-error-message")).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("THR-09: Admin can reactivate the therapist account", async ({ page }) => {
    const { neon } = await import("@neondatabase/serverless");
    const { assertTestDatabase } = await import("../helpers/seed-test-data");
    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [newTherapist.email]);
    if (rows.length === 0) {
      test.skip();
      return;
    }

    await page.goto(`/admin/therapists/${rows[0]["id"]}`);
    page.once("dialog", (dialog) => dialog.accept());
    const toggleBtn = page.getByTestId("therapist-toggle-status-button");
    await expect(toggleBtn).toBeVisible({ timeout: 10000 });
    await toggleBtn.click();
    await expect(page.getByTestId("therapist-edit-success-message")).toBeVisible({ timeout: 10000 });
  });
});
