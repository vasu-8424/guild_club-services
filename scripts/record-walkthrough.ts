import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
dotenv.config();
import { neon } from "@neondatabase/serverless";

async function run() {
  const artifactDir = "C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3";
  const videoOutputDir = path.join(artifactDir, "videos");
  fs.mkdirSync(videoOutputDir, { recursive: true });

  const publicVideoDir = path.resolve("public/recordings");
  fs.mkdirSync(publicVideoDir, { recursive: true });

  const samplePhotoPath = path.resolve("scripts/sample-intake-photo.png");

  const sql = neon(process.env.DATABASE_URL!);

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["geolocation"],
    geolocation: { latitude: 17.4123, longitude: 78.4234 },
    recordVideo: {
      dir: videoOutputDir,
      size: { width: 412, height: 915 },
    },
  });

  const page = await context.newPage();

  async function hideDevOverlay() {
    await page.evaluate(() => {
      document.querySelectorAll("nextjs-portal").forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });
    }).catch(() => {});
  }

  async function safeClick(selectorOrLocator: any) {
    await hideDevOverlay();
    if (typeof selectorOrLocator === "string") {
      await page.locator(selectorOrLocator).first().click({ force: true });
    } else {
      await selectorOrLocator.first().click({ force: true });
    }
  }

  async function takeSafeScreenshot(filePath: string) {
    try {
      await page.waitForTimeout(400);
      await page.screenshot({ path: filePath, animations: "disabled" });
    } catch {
      // ignore
    }
  }

  console.log("1. Navigating to login...");
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await takeSafeScreenshot(path.join(artifactDir, "step1-login.png"));

  console.log("2. Logging in as Mock Therapist...");
  await page.fill('[data-testid="login-email-input"]', "therapist.mock@guildclub.com");
  await page.fill('[data-testid="login-password-input"]', "GuildClub@2026");
  await safeClick('[data-testid="login-submit-button"]');

  await page.waitForURL("**/therapist/**", { timeout: 15000 });

  // Update sign-in location in DB to captured so therapist board is active
  await sql`
    UPDATE login_records 
    SET sign_in_location_status = 'captured', 
        sign_in_latitude = '17.4123', 
        sign_in_longitude = '78.4234' 
    WHERE user_id = (SELECT id FROM users WHERE email = 'therapist.mock@guildclub.com')`;

  await page.waitForTimeout(1000);
  await takeSafeScreenshot(path.join(artifactDir, "step2-therapist-dashboard.png"));

  console.log("3. Navigating to Patients tab...");
  await safeClick('[data-testid="tab-therapist-patients"]');
  await page.waitForURL("**/therapist/cases", { timeout: 10000 });
  await page.waitForTimeout(1000);
  await takeSafeScreenshot(path.join(artifactDir, "step3-patients-list.png"));

  console.log("4. Opening Create Case Form...");
  const createBtn = page.locator('[data-testid="create-case-btn"]').first();
  if (await createBtn.isVisible()) {
    await safeClick(createBtn);
    await page.waitForTimeout(500);
  }
  await page.goto("http://localhost:3000/therapist/cases/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await takeSafeScreenshot(path.join(artifactDir, "step4-create-case-top.png"));

  console.log("5. Filling Patient Details...");
  await page.fill('[data-testid="patient-name-input"]', "Ramesh Kumar");
  await page.fill('[data-testid="patient-age-input"]', "38");
  await page.selectOption('[data-testid="patient-sex-select"]', "male");

  await page.fill('[data-testid="problem-input"]', "Post-stroke hemiparesis with left arm weakness");
  await page.fill('[data-testid="present-condition-input"]', "Limited left shoulder elevation and weak palmar grasp");

  await page.selectOption('[data-testid="service-select"]', "vitalstim_therapy");

  console.log("6. Testing Date Quick Buttons & Smooth Scroll...");
  await safeClick('[data-testid="start-date-today-btn"]');
  await page.waitForTimeout(400);

  // Smooth scroll down to Schedule and Photos
  await page.evaluate(() => window.scrollBy({ top: 320, behavior: "smooth" }));
  await page.waitForTimeout(800);
  await takeSafeScreenshot(path.join(artifactDir, "step5-create-case-middle-scrolled.png"));

  console.log("7. Uploading joining condition photo via Gallery...");
  const photoInput = page.locator('[data-testid="joining-photo-input"]');
  await photoInput.setInputFiles(samplePhotoPath);

  // Wait for photo thumbnail to appear in form
  await page.locator('button[data-testid^="remove-photo-"]').first().waitFor({ state: "visible", timeout: 10000 });
  console.log("Photo uploaded and compressed successfully!");
  await page.waitForTimeout(800);

  // Smooth scroll down to consent and submit button
  await page.evaluate(() => window.scrollBy({ top: 450, behavior: "smooth" }));
  await page.waitForTimeout(800);
  await takeSafeScreenshot(path.join(artifactDir, "step6-create-case-bottom-scrolled.png"));

  // Consent checkbox
  await safeClick('label[for="consent-checkbox"]');
  await page.waitForTimeout(500);

  console.log("8. Submitting Create Case...");
  await safeClick('[data-testid="submit-case-btn"]');

  // Wait for success screen with created patient ID
  const successIndicator = page.locator('[data-testid="created-patient-id"]');
  await successIndicator.first().waitFor({ state: "visible", timeout: 15000 });
  const createdPatientId = await successIndicator.first().innerText();
  console.log("Patient created successfully:", createdPatientId);

  await page.waitForTimeout(1000);
  await takeSafeScreenshot(path.join(artifactDir, "step7-case-created-success.png"));

  // Click go to case
  console.log("Navigating to created case...");
  await safeClick('[data-testid="go-to-case-btn"]');
  await page.waitForURL(/\/therapist\/cases\/[a-f0-9-]+/, { timeout: 10000 });
  const createdCaseUrl = page.url();
  await page.waitForTimeout(1500);
  await takeSafeScreenshot(path.join(artifactDir, "step8-case-profile-page.png"));

  console.log("9. Going to Today's Dashboard to Record Session...");
  await safeClick('[data-testid="tab-therapist-today"]');
  await page.waitForURL("**/therapist/dashboard", { timeout: 10000 });
  await page.waitForTimeout(1500);
  await takeSafeScreenshot(path.join(artifactDir, "step9-today-dashboard.png"));

  // Click on Ramesh Kumar's case tile to open session record panel
  console.log("10. Opening Today's Session Record Panel...");
  const rameshTile = page.locator('[data-testid="case-tile"]').filter({ hasText: createdPatientId }).first();
  await safeClick(rameshTile);
  await page.waitForTimeout(1200);
  await takeSafeScreenshot(path.join(artifactDir, "step10-session-panel-open.png"));

  console.log("11. Entering Session observations and patient signature...");
  await page.fill('[data-testid="present-condition-input"]', "Patient demonstrates improved active finger flexion today and decreased spasticity.");
  await page.fill('[data-testid="session-note-input"]', "Completed 45 minutes of electrical muscle stimulation and active range of motion training.");

  // Draw signature on canvas
  const canvas = page.locator('canvas[data-testid="signature-canvas"]');
  if (await canvas.count() > 0) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 25);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + 50);
      await page.mouse.move(box.x + 130, box.y + 25);
      await page.mouse.move(box.x + 180, box.y + 60);
      await page.mouse.up();
    }
  }

  await page.waitForTimeout(800);
  await takeSafeScreenshot(path.join(artifactDir, "step11-session-signed.png"));

  console.log("12. Saving Today's Session...");
  await safeClick('[data-testid="save-session-btn"]');
  await page.waitForTimeout(2500);
  await takeSafeScreenshot(path.join(artifactDir, "step12-session-saved-done.png"));

  console.log("13. Navigating back to Case to Close Case...");
  await page.goto(createdCaseUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await takeSafeScreenshot(path.join(artifactDir, "step13-case-ready-to-close.png"));

  console.log("14. Opening Close Case Modal...");
  const closeCaseBtn = page.locator('button:has-text("Close Case"), [data-testid="close-case-btn"]').first();
  await safeClick(closeCaseBtn);
  await page.waitForTimeout(1000);
  await takeSafeScreenshot(path.join(artifactDir, "step14-close-case-modal-top.png"));

  console.log("15. Entering Clinical Final Report & Outcome...");
  await page.fill('[data-testid="close-present-condition-input"]', "Patient has regained functional movement in the left arm and hand with minimal residual weakness.");
  await page.fill('[data-testid="close-progress-text-input"]', "Grip strength increased from grade 2 to grade 4+. Patient independently performs daily grooming.");
  await page.fill('[data-testid="close-treatment-plan-input"]', "Transition to home exercise regimen with monthly outpatient clinical follow-up.");
  await page.fill('[data-testid="close-summary-input"]', "Clinical goals achieved successfully with excellent patient compliance.");

  // Upload discharge condition photo
  console.log("Uploading discharge photo...");
  const closePhotoInput = page.locator('[data-testid="close-photo-input"]');
  await closePhotoInput.setInputFiles(samplePhotoPath);
  await page.waitForTimeout(1200);

  await page.selectOption('[data-testid="close-outcome-select"]', "improved");

  // Smooth scroll inside modal
  await page.evaluate(() => {
    const form = document.querySelector("form.overflow-y-auto");
    if (form) form.scrollBy({ top: 350, behavior: "smooth" });
  });
  await page.waitForTimeout(800);
  await takeSafeScreenshot(path.join(artifactDir, "step15-close-case-modal-scrolled.png"));

  // Proceed to confirm
  console.log("16. Confirming Case Closure...");
  const proceedBtn = page.locator('button[type="submit"]:has-text("Review & Close Case")').first();
  await safeClick(proceedBtn);
  await page.waitForTimeout(800);
  await takeSafeScreenshot(path.join(artifactDir, "step16-closure-confirmation.png"));

  const confirmBtn = page.locator('[data-testid="confirm-close-case-btn"]').first();
  await safeClick(confirmBtn);
  await page.waitForTimeout(2500);
  await takeSafeScreenshot(path.join(artifactDir, "step17-case-closed-success.png"));

  console.log("17. Visiting Admin Dashboard to verify smooth scrolling...");
  await context.clearCookies();
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('[data-testid="login-email-input"]', "admin.mock@guildclub.com");
  await page.fill('[data-testid="login-password-input"]', "GuildClub@2026");
  await safeClick('[data-testid="login-submit-button"]');
  await page.waitForURL("**/admin/**", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Test scrolling on admin dashboard
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "smooth" }));
  await page.waitForTimeout(800);
  await takeSafeScreenshot(path.join(artifactDir, "step18-admin-dashboard-scrolled.png"));

  console.log("Walkthrough finished successfully! Finalizing video...");
  await page.close();
  await context.close();
  await browser.close();

  // Find generated video
  const files = fs.readdirSync(videoOutputDir).filter((f) => f.endsWith(".webm"));
  if (files.length > 0) {
    const newest = files.sort(
      (a, b) =>
        fs.statSync(path.join(videoOutputDir, b)).mtimeMs -
        fs.statSync(path.join(videoOutputDir, a)).mtimeMs
    )[0];
    const sourceVideo = path.join(videoOutputDir, newest);
    const destVideo = path.join(publicVideoDir, "therapist-workflow.webm");
    fs.copyFileSync(sourceVideo, destVideo);
    console.log(`WALKTHROUGH_VIDEO_READY: ${destVideo}`);
  }
}

run().catch((err) => {
  console.error("RECORDING_ERROR:", err);
  process.exit(1);
});
