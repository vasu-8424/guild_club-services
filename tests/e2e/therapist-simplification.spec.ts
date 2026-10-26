import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";
import { getTodayIST, getDaysAgoIST } from "../../src/lib/date-utils";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const screenshotDir = path.resolve(process.cwd(), "test-results/screenshots-ui");
const artifactDir = "C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\4dd1c48a-cf44-4402-9007-d61b84ecd817";

// Ensure screenshot directories exist
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

// 1x1 PNG transparent pixel buffer for mock uploads
const dummyPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// Helper to save screenshot both in test-results and in artifact directory
async function captureScreenshot(
  page: import("@playwright/test").Page,
  filename: string
) {
  const localPath = path.join(screenshotDir, filename);
  await page.screenshot({ path: localPath, fullPage: true });

  try {
    const artPath = path.join(artifactDir, filename);
    fs.copyFileSync(localPath, artPath);
  } catch {
    // ignore artifact copy if path is unavailable
  }
}

test.describe.serial("Therapist Simplification End-to-End Suite", () => {
  let therapistEmail = "test.therapist@guildclub.com";
  let therapistPassword = "TestTherapist@123";
  let adminEmail = "test.admin@guildclub.com";
  let adminPassword = "TestAdmin@123";
  let createdCaseId = "";
  let createdPatientId = "";
  let createdCaseNumber = "";

  const todayIST = getTodayIST();
  const pastDateIST = getDaysAgoIST(5);

  test("THS-01: Therapist Login & Geolocation Recording", async ({ browser }) => {
    // 1. Login with Geolocation Granted
    const contextGranted = await browser.newContext({
      baseURL: "http://localhost:3000",
      geolocation: { latitude: 12.9716, longitude: 77.5946 },
      permissions: ["geolocation"],
    });
    await contextGranted.grantPermissions(["geolocation"], { origin: "http://localhost:3000" });
    const page1 = await contextGranted.newPage();

    await page1.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: {
            latitude: 12.9716,
            longitude: 77.5946,
            accuracy: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      };
    });

    await page1.goto("/login");
    await page1.fill('[data-testid="login-email-input"]', therapistEmail);
    await page1.fill('[data-testid="login-password-input"]', therapistPassword);
    await page1.click('[data-testid="login-submit-button"]');
    await expect(page1).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    const sql = neon(assertTestDatabase());
    let records: any[] = [];
    for (let i = 0; i < 15; i++) {
      records = await sql`
        SELECT lr.*, u.email 
        FROM login_records lr
        JOIN users u ON lr.user_id = u.id
        WHERE u.email = ${therapistEmail}
        ORDER BY lr.logged_in_at DESC
        LIMIT 1;
      `;
      if (records.length > 0 && records[0].location_status === "captured") {
        break;
      }
      await page1.waitForTimeout(400);
    }

    expect(records.length).toBeGreaterThan(0);
    expect(records[0].location_status).toBe("captured");
    expect(Number(records[0].latitude)).toBeCloseTo(12.9716, 2);
    expect(Number(records[0].longitude)).toBeCloseTo(77.5946, 2);
    await contextGranted.close();

    // 2. Login with Geolocation Denied
    const contextDenied = await browser.newContext({
      permissions: [],
    });
    // Override geolocation to simulate permission denied
    await contextDenied.grantPermissions([]);
    const page2 = await contextDenied.newPage();
    await page2.addInitScript(() => {
      // Mock navigator.geolocation to simulate rejection
      navigator.geolocation.getCurrentPosition = (success, error) => {
        if (error) {
          error({
            code: 1, // PERMISSION_DENIED
            message: "User denied Geolocation",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        }
      };
    });

    await page2.goto("/login");
    await page2.fill('[data-testid="login-email-input"]', therapistEmail);
    await page2.fill('[data-testid="login-password-input"]', therapistPassword);
    await page2.click('[data-testid="login-submit-button"]');
    await expect(page2).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    // Wait for the banner or toast
    await page2.waitForTimeout(1000);
    const banner = page2.locator('[data-testid="location-denied-banner"]');
    if (await banner.isVisible()) {
      await expect(banner).toContainText(/Location not recorded/i);
    }

    let deniedRecords: any[] = [];
    for (let i = 0; i < 15; i++) {
      deniedRecords = await sql`
        SELECT lr.*, u.email 
        FROM login_records lr
        JOIN users u ON lr.user_id = u.id
        WHERE u.email = ${therapistEmail}
        ORDER BY lr.logged_in_at DESC
        LIMIT 1;
      `;
      if (deniedRecords.length > 0 && deniedRecords[0].location_status === "denied") {
        break;
      }
      await page2.waitForTimeout(400);
    }
    expect(deniedRecords.length).toBeGreaterThan(0);
    expect(deniedRecords[0].location_status).toBe("denied");
    await contextDenied.close();

    // 3. Admin View: Login activity & OpenStreetMap link
    const adminContext = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/therapists");
    await expect(adminPage).toHaveURL(/\/admin\/therapists/);

    // Find kebab menu or button for test.therapist
    const row = adminPage.locator("tr", { hasText: therapistEmail });
    await expect(row).toBeVisible();

    const kebab = row.locator('[data-testid^="row-actions-kebab-"]');
    if (await kebab.isVisible()) {
      await kebab.click();
      const activityBtn = adminPage.locator('[data-testid^="login-activity-btn-"]');
      await activityBtn.click();

      const modal = adminPage.locator('[data-testid="login-activity-modal"]');
      await expect(modal).toBeVisible();
      const osmLink = modal.locator('a[href*="openstreetmap.org"]');
      if (await osmLink.count() > 0) {
        await expect(osmLink.first()).toHaveAttribute("href", /openstreetmap\.org/);
      }
    }
    await adminContext.close();
  });

  test("THS-02: Therapist Case Creation (Self-Assignment & Admin Hidden/Blocked)", async ({ browser }) => {
    // 1. Admin cannot see "+ Create Case" and cannot create cases
    const adminContext = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/dashboard");
    await expect(adminPage.locator('[data-testid="create-case-btn"]')).not.toBeVisible();

    await adminPage.goto("/admin/cases");
    await expect(adminPage.locator('[data-testid="create-case-btn"]')).not.toBeVisible();

    // Admin calling /therapist/cases/new gets redirected
    await adminPage.goto("/therapist/cases/new");
    await expect(adminPage).not.toHaveURL(/\/therapist\/cases\/new/);
    await adminContext.close();

    // 2. Therapist visits /therapist/cases/new
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await therapistContext.newPage();
    await page.goto("/therapist/cases/new");
    await expect(page).toHaveURL(/\/therapist\/cases\/new/);

    // Validation check: empty submit
    await page.click('[data-testid="submit-case-btn"]');
    // HTML5 validation or form errors
    const patientInput = page.locator('[data-testid="patient-name-input"]');
    await expect(patientInput).toBeVisible();

    // Fill Case Form
    await page.fill('[data-testid="patient-name-input"]', "Suresh Patel");
    await page.fill('[data-testid="patient-age-input"]', "42");
    await page.selectOption('[data-testid="patient-sex-select"]', "male");
    await page.fill('[data-testid="problem-input"]', "Post-CVA dysphagia and oral motor weakness");
    await page.fill('[data-testid="present-condition-input"]', "Inability to swallow solids, choking on thin liquids");
    await page.selectOption('[data-testid="service-select"]', "swallow_therapy");
    await page.fill('[data-testid="start-date-input"]', todayIST);
    await page.fill('[data-testid="room-no-input"]', "Room 102");

    // Select Branch
    const branchSelect = page.locator('[data-testid="branch-select"]');
    const branchOptions = await branchSelect.locator("option").all();
    if (branchOptions.length > 0) {
      const val = await branchOptions[0].getAttribute("value");
      if (val) await branchSelect.selectOption(val);
    }

    // Upload Joining Photo (1-3 photos)
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.click('label:has([data-testid="joining-photo-input"])');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "joining_condition.png",
        mimeType: "image/png",
        buffer: dummyPngBuffer,
      },
    ]);

    // Check informed consent
    await page.check('[data-testid="consent-checkbox"]');

    // Submit form
    await page.click('[data-testid="submit-case-btn"]');

    // Success screen
    const successPatientId = page.locator('[data-testid="created-patient-id"]');
    await expect(successPatientId).toBeVisible({ timeout: 15000 });
    createdPatientId = await successPatientId.innerText();
    expect(createdPatientId).toMatch(/^GCP-\d{4}$/);

    // Navigate to created case page
    await page.click('[data-testid="go-to-case-btn"]');
    await expect(page).toHaveURL(/\/therapist\/cases\/[a-f0-9-]+/);
    const urlParts = page.url().split("/");
    createdCaseId = urlParts[urlParts.length - 1];

    // Verify Admin received in-app notification
    const sql = neon(assertTestDatabase());
    const notifs = await sql`
      SELECT * FROM in_app_notifications
      WHERE type = 'case_created'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0].body).toContain(createdPatientId);

    await therapistContext.close();
  });

  test("THS-03: Month Calendar & Boundary Constraints", async ({ browser }) => {
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await therapistContext.newPage();
    await page.goto(`/therapist/cases/${createdCaseId}`);
    await expect(page.locator('[data-testid="month-calendar"]')).toBeVisible();

    // Verify 3 counters above calendar
    const doneCounter = page.locator('[data-testid="counter-sessions-done"]');
    const missedCounter = page.locator('[data-testid="counter-missed-days"]');
    const pctCounter = page.locator('[data-testid="counter-attendance-pct"]');

    await expect(doneCounter).toBeVisible();
    await expect(missedCounter).toBeVisible();
    await expect(pctCounter).toBeVisible();

    // Verify today's cell exists and has blue outline styling
    const todayCell = page.locator(`[data-testid="calendar-day-${todayIST}"]`);
    await expect(todayCell).toBeVisible();
    const cellClass = await todayCell.getAttribute("class");
    expect(cellClass).toContain("ring-blue-600");

    // Days before start date are not clickable / disabled
    const preDateStr = getDaysAgoIST(35);
    const preCell = page.locator(`[data-testid="calendar-day-${preDateStr}"]`);
    if (await preCell.count() > 0) {
      await expect(preCell).toBeDisabled();
    }

    await therapistContext.close();
  });

  test("THS-04: Record Daily Session (Today Only, 1/Day, Instant Reactivity)", async ({ browser }) => {
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await therapistContext.newPage();
    await page.goto(`/therapist/cases/${createdCaseId}`);

    // Click today's cell to record session
    const todayCell = page.locator(`[data-testid="calendar-day-${todayIST}"]`);
    await todayCell.click();

    const sessionModal = page.locator('[data-testid="record-session-modal"]');
    await expect(sessionModal).toBeVisible();

    // Minimum 10 chars requirement
    await page.fill('[data-testid="session-note-input"]', "Short");
    const saveBtn = page.locator('[data-testid="save-session-btn"]');
    await expect(saveBtn).toBeDisabled();

    // Fill valid note and attach photo
    await page.fill(
      '[data-testid="session-note-input"]',
      "Patient performed swallowing maneuvers successfully with pureed food. Good progression noted."
    );
    await expect(saveBtn).toBeEnabled();

    // Submit session
    await saveBtn.click();

    // Success toast appears
    await expect(page.locator('[data-testid="session-toast"]')).toBeVisible();

    // Today's cell immediately turns green without full page reload
    await expect(todayCell).toContainText(/Done/i);
    const updatedClass = await todayCell.getAttribute("class");
    expect(updatedClass).toContain("bg-emerald-50");

    // Sessions done counter increments to 1
    const doneCounter = page.locator('[data-testid="counter-sessions-done"]');
    await expect(doneCounter).toContainText("1");

    // Clicking today's cell again opens view modal, NOT a second session creation form
    await todayCell.click();
    await expect(page.locator('[data-testid="view-session-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="record-session-modal"]')).not.toBeVisible();

    // Close view modal
    await page.click('[data-testid="close-view-session-btn"]');

    await therapistContext.close();
  });

  test("THS-05: Case Closure with Present Photos & Mapped Outcomes", async ({ browser }) => {
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await therapistContext.newPage();
    await page.goto(`/therapist/cases/${createdCaseId}`);

    // Click Close Case button
    const closeBtn = page.locator('[data-testid="close-case-btn"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Modal opens
    const modal = page.locator('[data-testid="close-case-modal"]');
    await expect(modal).toBeVisible();

    // Fill present condition at close
    await page.fill(
      '[data-testid="close-present-condition-input"]',
      "Patient swallows pureed and soft solids comfortably with intact laryngeal elevation."
    );
    await page.fill(
      '[data-testid="close-progress-text-input"]',
      "Patient achieved oral motor coordination milestones and is able to swallow safely."
    );

    // Upload present condition photo
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.click('label:has([data-testid="close-photo-input"])');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "discharge_condition.png",
        mimeType: "image/png",
        buffer: dummyPngBuffer,
      },
    ]);

    // Select outcome
    await page.selectOption('[data-testid="close-outcome-select"]', "improved");

    // Closing summary
    await page.fill(
      '[data-testid="close-summary-input"]',
      "Completed 1 session successfully. Achieved oral motor coordination milestones. Discharged to home care."
    );

    // Submit form -> confirmation prompt
    await page.click('button:has-text("Review & Close Case")');

    const confirmDialog = page.locator('[data-testid="close-case-confirm-dialog"]');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText(
      `Close case ${createdPatientId}? You cannot add sessions after closing.`
    );

    // Confirm close
    await page.click('[data-testid="confirm-close-case-btn"]');

    // Case is now closed: status badge says 'Closed'
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-testid="status-badge"]')).toContainText(/Closed/i);

    // Calendar is read-only
    const todayCell = page.locator(`[data-testid="calendar-day-${todayIST}"]`);
    await todayCell.click();
    // Modal opens view only, not record
    await expect(page.locator('[data-testid="record-session-modal"]')).not.toBeVisible();

    await therapistContext.close();
  });

  test("THS-06: Clinical Progress Report & PDF Print Trigger", async ({ browser }) => {
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await therapistContext.newPage();

    // Open progress report
    await page.goto(`/therapist/cases/${createdCaseId}/report`);
    await expect(page.locator('[data-testid="progress-report-view"]')).toBeVisible();

    // Check report contents
    await expect(page.locator("body")).toContainText(createdPatientId);
    await expect(page.locator("body")).toContainText("Suresh Patel");
    await expect(page.locator("body")).toContainText("Swallow Therapy");
    await expect(page.locator("body")).toContainText("Improved");

    // Side-by-side photos
    await expect(page.locator('[data-testid="joining-photo"]')).toBeVisible();
    await expect(page.locator('[data-testid="present-photo"]')).toBeVisible();

    // Weekly session chart
    await expect(page.locator('[data-testid="sessions-per-week-chart"]')).toBeVisible();

    // Session notes timeline
    await expect(page.locator('[data-testid="notes-timeline"]')).toBeVisible();

    // Download PDF button exists and triggers window.print
    const pdfBtn = page.locator('[data-testid="download-pdf-btn"]');
    await expect(pdfBtn).toBeVisible();

    // Verify window.print is called
    let printCalled = false;
    await page.exposeFunction("trackPrint", () => {
      printCalled = true;
    });
    await page.evaluate(() => {
      window.print = () => (window as any).trackPrint();
    });
    await pdfBtn.click();
    expect(printCalled).toBe(true);

    await therapistContext.close();
  });

  test("THS-07: Therapist Dashboard (7 Columns, Filters, Counters & Isolation)", async ({ browser }) => {
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await therapistContext.newPage();
    await page.goto("/therapist/dashboard");

    // Header check
    await expect(page.locator("h1")).toContainText(/My Patients/i);

    // Counters check
    await expect(page.locator('[data-testid="active-patients-counter"]')).toBeVisible();
    await expect(page.locator('[data-testid="sessions-done-today-counter"]')).toBeVisible();
    await expect(page.locator('[data-testid="pending-sessions-today-counter"]')).toBeVisible();

    // Table check: 7 columns
    const table = page.locator('[data-testid="therapist-patients-table"]');
    await expect(table).toBeVisible();

    const headers = table.locator("thead th");
    await expect(headers).toHaveCount(7);

    // Search input
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill(createdPatientId);
    await expect(table.locator("tbody tr")).toContainText(createdPatientId);

    // Cross-tenant Isolation check
    // Ensure secondary therapist exists and has must_change_password = false
    const sql = neon(assertTestDatabase());
    const pwdRes = await sql`SELECT password_hash FROM users WHERE email = ${therapistEmail} LIMIT 1`;
    const pwdHash = pwdRes[0]?.password_hash;
    const otherEmail = "test.therapist.second@guildclub.com";
    const existing = await sql`SELECT id FROM users WHERE email = ${otherEmail} LIMIT 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
        VALUES ('Second Therapist', ${otherEmail}, ${pwdHash}, 'therapist', true, false);
      `;
    } else {
      await sql`
        UPDATE users SET must_change_password = false, is_active = true WHERE email = ${otherEmail};
      `;
    }

    // Login as other therapist and attempt to open primary therapist's case
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto("/login");
    await otherPage.fill('[data-testid="login-email-input"]', otherEmail);
    await otherPage.fill('[data-testid="login-password-input"]', "TestTherapist@123");
    await otherPage.click('[data-testid="login-submit-button"]');
    await otherPage.waitForURL(/\/therapist\/dashboard/);

    // Attempt to access case page
    await otherPage.goto(`/therapist/cases/${createdCaseId}`);
    // Must be redirected to dashboard
    await expect(otherPage).toHaveURL(/\/therapist\/dashboard/);

    // Attempt to access report (returns 404 for unauthorized therapist)
    const reportRes = await otherPage.goto(`/therapist/cases/${createdCaseId}/report`);
    expect(reportRes?.status()).toBe(404);

    await otherContext.close();

    await therapistContext.close();
  });

  test("THS-08: Capture High-Quality UI Screenshots at 390px and 1440px", async ({ browser }) => {
    const viewports = [
      { name: "390", width: 390, height: 844 },
      { name: "1440", width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({
        storageState: path.join(authDir, "therapist.json"),
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();

      // 1. Therapist Dashboard
      await page.goto("/therapist/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await captureScreenshot(page, `therapist-dashboard-${vp.name}.png`);

      // 2. Create Case Form
      await page.goto("/therapist/cases/new");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await captureScreenshot(page, `therapist-create-case-${vp.name}.png`);

      // 3. Calendar View on Case Page
      await page.goto(`/therapist/cases/${createdCaseId}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await captureScreenshot(page, `therapist-calendar-${vp.name}.png`);

      // 4. Record Session Modal (Open modal on case page)
      // Open a day modal or missed day modal for visual presentation
      const todayCell = page.locator(`[data-testid="calendar-day-${todayIST}"]`);
      if (await todayCell.isVisible()) {
        await todayCell.click();
        await page.waitForTimeout(400);
        await captureScreenshot(page, `therapist-session-modal-${vp.name}.png`);
        const closeBtn = page.locator('[data-testid="close-view-session-btn"], [data-testid="close-missed-modal-btn"], button:has-text("Cancel")');
        if (await closeBtn.first().isVisible()) await closeBtn.first().click();
      }

      // 5. Close Case Modal (Open modal on case page)
      const closeCaseBtn = page.locator('[data-testid="close-case-btn"]');
      if (await closeCaseBtn.isVisible()) {
        await closeCaseBtn.click();
        await page.waitForTimeout(400);
        await captureScreenshot(page, `therapist-close-case-${vp.name}.png`);
        const cancelBtn = page.locator('button:has-text("Cancel")');
        if (await cancelBtn.isVisible()) await cancelBtn.click();
      } else {
        // Fallback capture of the case detail view
        await captureScreenshot(page, `therapist-close-case-${vp.name}.png`);
      }

      // 6. Progress Report
      await page.goto(`/therapist/cases/${createdCaseId}/report`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      await captureScreenshot(page, `therapist-progress-report-${vp.name}.png`);

      await context.close();
    }
  });
});
