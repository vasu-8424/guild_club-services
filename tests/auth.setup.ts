import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { seedTestData } from "./helpers/seed-test-data";

const authDir = path.resolve(process.cwd(), "playwright/.auth");

setup("reset database and initialize role sessions", async ({ page }) => {
  setup.setTimeout(60000);
  // 1. Reset and reseed test database
  const seeded = await seedTestData();

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 2. Super Admin Session Setup
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', seeded.superAdmin.email);
  await page.fill('[data-testid="login-password-input"]', seeded.superAdmin.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: path.join(authDir, "super-admin.json") });

  // 3. Admin Session Setup
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', seeded.admin.email);
  await page.fill('[data-testid="login-password-input"]', seeded.admin.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: path.join(authDir, "admin.json") });

  // 4. Therapist Session Setup
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', seeded.therapist.email);
  await page.fill('[data-testid="login-password-input"]', seeded.therapist.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: path.join(authDir, "therapist.json") });

  console.log("✅ Playwright role storage states saved for Super Admin, Admin, and Therapist.");
});
