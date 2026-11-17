import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("console", msg => console.log("PAGE LOG:", msg.type(), msg.text()));

  await page.goto("http://localhost:3000/login");
  await page.fill('[data-testid="login-email-input"]', "therapist.mock@guildclub.com");
  await page.fill('[data-testid="login-password-input"]', "GuildClub@2026");
  await page.click('[data-testid="login-submit-button"]');
  await page.waitForURL("**/therapist/**");

  await page.goto("http://localhost:3000/therapist/cases/new");
  await page.waitForTimeout(1000);

  const realPng = "C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3/ramesh-case-header-iphone.png";
  console.log("Setting input files with real PNG...");
  const input = page.locator('[data-testid="joining-photo-input"]');
  await input.setInputFiles(realPng);
  await page.waitForTimeout(2000);

  const removeButtons = await page.locator('button[data-testid^="remove-photo-"]').count();
  console.log("Remove photo buttons found:", removeButtons);

  await browser.close();
}
main().catch(console.error);
