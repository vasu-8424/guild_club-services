import { test as setup, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { seedTestData } from "./helpers/seed-test-data";

const authDir = path.resolve(process.cwd(), "playwright/.auth");

setup("reset database and initialize role sessions", async ({ page }) => {
  setup.setTimeout(120000);
  // 1. Reset and reseed test database
  const seeded = await seedTestData();
  await new Promise((r) => setTimeout(r, 1000));

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 2. Super Admin Session Setup
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', seeded.superAdmin.email);
  await page.fill('[data-testid="login-password-input"]', seeded.superAdmin.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 30000 });
  await page.context().storageState({ path: path.join(authDir, "super-admin.json") });

  // 3. Admin Session Setup
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', seeded.adminMain.email);
  await page.fill('[data-testid="login-password-input"]', seeded.adminMain.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30000 });
  await page.context().storageState({ path: path.join(authDir, "admin.json") });

  // 4. Therapist Session Setup
  await page.context().clearCookies();
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 17.4325, longitude: 78.4071 });
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', seeded.therapist1.email);
  await page.fill('[data-testid="login-password-input"]', seeded.therapist1.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 30000 });

  // If LocationGate appears, wait for geolocation capture to refresh page
  try {
    await page.waitForSelector('[data-testid="daily-board"]', { timeout: 10000 });
  } catch {
    // If still pending, reload once
    await page.reload();
    await page.waitForSelector('[data-testid="daily-board"]', { timeout: 10000 }).catch(() => {});
  }

  await page.context().storageState({ path: path.join(authDir, "therapist.json") });

  console.log("✅ Playwright role storage states saved for Super Admin, Admin, and Therapist.");
});
