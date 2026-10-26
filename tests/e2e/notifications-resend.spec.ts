import { test, expect } from "@playwright/test";
import { loginAs } from "../helpers/stage2-helpers";

const SUPER_ADMIN = {
  email: process.env.TEST_SUPER_ADMIN_EMAIL || "test.superadmin@guildclub.com",
  password: process.env.TEST_SUPER_ADMIN_PASSWORD || "TestSuperAdmin@123",
};

const THERAPIST = {
  email: process.env.TEST_THERAPIST_EMAIL || "test.therapist@guildclub.com",
  password: process.env.TEST_THERAPIST_PASSWORD || "TestTherapist@123",
};

test.describe("Notification Delivery & Quota Management", () => {
  test("Super Admin can view notification delivery page and quota metrics", async ({ page }) => {
    await loginAs(page, SUPER_ADMIN.email, SUPER_ADMIN.password);
    await page.goto("/super-admin/notifications");

    await expect(page).toHaveURL(/\/super-admin\/notifications/);
    await expect(page.locator("h1")).toContainText("Notification Delivery & Quota");

    // Verify metrics cards
    await expect(page.getByText("Today's Usage (IST)")).toBeVisible();
    await expect(page.getByText("Monthly Usage (IST)")).toBeVisible();
    await expect(page.getByText("Active Provider")).toBeVisible();

    // Verify action buttons
    const testEmailBtn = page.getByRole("button", { name: "Send test email to myself" });
    await expect(testEmailBtn).toBeVisible();

    const retryBtn = page.getByRole("button", { name: "Retry & Process Queue" });
    await expect(retryBtn).toBeVisible();

    // Verify recent deliveries table
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("Therapist cannot access super-admin notifications delivery page", async ({ page }) => {
    await loginAs(page, THERAPIST.email, THERAPIST.password);
    await page.goto("/super-admin/notifications");

    // Should be redirected away (to /therapist/dashboard or /login)
    await expect(page).not.toHaveURL(/\/super-admin\/notifications/);
  });
});
