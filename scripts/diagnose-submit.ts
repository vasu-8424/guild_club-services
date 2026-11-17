import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('[data-testid="login-email-input"]', "therapist.mock@guildclub.com");
  await page.fill('[data-testid="login-password-input"]', "GuildClub@2026");
  await page.click('[data-testid="login-submit-button"]');
  await page.waitForURL("**/therapist/**");

  await page.goto("http://localhost:3000/therapist/cases/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Fill details
  await page.fill('[data-testid="patient-name-input"]', "Ramesh Kumar");
  await page.fill('[data-testid="patient-age-input"]', "38");
  await page.selectOption('[data-testid="patient-sex-select"]', "male");
  await page.fill('[data-testid="problem-input"]', "Post-stroke hemiparesis with left arm weakness");
  await page.fill('[data-testid="present-condition-input"]', "Limited left shoulder elevation and weak palmar grasp");
  await page.selectOption('[data-testid="service-select"]', "vitalstim_therapy");
  await page.click('[data-testid="start-date-today-btn"]');

  // Check room selection
  const roomVal = await page.locator('[data-testid="room-select"]').inputValue().catch(() => "NO_SELECT");
  console.log("Current room selection value:", roomVal);

  // Upload photo
  const photoInput = page.locator('[data-testid="joining-photo-input"]');
  await photoInput.setInputFiles("scripts/sample-intake-photo.png");
  await page.waitForTimeout(1000);

  // Check photos state in DOM
  const photoCount = await page.locator('button[data-testid^="remove-photo-"], img[alt^="Joining condition"]').count();
  console.log("Uploaded photos in DOM:", photoCount);

  // Consent checkbox
  await page.locator('label[for="consent-checkbox"]').click();
  const consentChecked = await page.locator('[data-testid="consent-checkbox"]').isChecked();
  console.log("Consent checked:", consentChecked);

  // Click submit
  console.log("Clicking submit...");
  await page.click('[data-testid="submit-case-btn"]');
  await page.waitForTimeout(2000);

  const errors = await page.locator('.text-red-600, [data-testid="create-case-error"]').allInnerTexts();
  console.log("Errors after submit:", errors);

  const success = await page.locator('[data-testid="created-patient-id"]').allInnerTexts();
  console.log("Success patient ID:", success);

  await page.screenshot({ path: "scripts/diagnostic-after-submit.png" });
  await browser.close();
}
main().catch(console.error);
