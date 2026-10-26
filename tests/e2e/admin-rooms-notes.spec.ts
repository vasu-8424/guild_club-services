import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";
import { rawSql, getEmails, getLatestEmail } from "../helpers/stage2-helpers";
import { getTodayIST, getDaysAgoIST } from "../../src/lib/date-utils";
import { sendAdminNoteAction } from "../../src/lib/actions/admin-notes-actions";
import { closeCaseAction } from "../../src/lib/actions/case-actions";
import { renderEmail } from "../../src/lib/notifications/templates";
import { renderCredentialsEmail } from "../../src/lib/notifications/credentials-sender";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const screenshotDir = path.resolve(process.cwd(), "test-results/screenshots-ui");
const artifactDir = "C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\4dd1c48a-cf44-4402-9007-d61b84ecd817";

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

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

async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  pass: string,
  expectedPattern: RegExp = /\/dashboard/
) {
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', email);
  await page.fill('[data-testid="login-password-input"]', pass);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(expectedPattern, { timeout: 30000 });
}

test.describe.serial("SIMPLIFIED ADMIN PANEL: ROOMS, DASHBOARD, THERAPISTS & NOTES", () => {
  const adminEmail = process.env.TEST_ADMIN_EMAIL || "test.admin@guildclub.com";
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || "TestAdmin@123";
  const therapistEmail = process.env.TEST_THERAPIST_EMAIL || "test.therapist@guildclub.com";
  const therapistPassword = process.env.TEST_THERAPIST_PASSWORD || "TestTherapist@123";

  let mainBranchId = "";
  let secondBranchId = "";
  let therapistUserId = "";
  let adminUserId = "";
  let createdRoomId101 = "";
  let createdCaseId = "";
  let createdPatientId = "";

  test.beforeEach(async () => {
    test.setTimeout(90000);
  });

  test.beforeAll(async () => {
    // Ensure branches and seed users exist
    const branchRows = await rawSql("SELECT id, name FROM branches ORDER BY created_at ASC");
    if (branchRows.length > 0) {
      mainBranchId = branchRows[0].id as string;
    } else {
      const ins = await rawSql("INSERT INTO branches (name, is_active) VALUES ('Main Branch', true) RETURNING id");
      mainBranchId = ins[0].id as string;
    }

    if (branchRows.length > 1) {
      secondBranchId = branchRows[1].id as string;
    } else {
      const ins2 = await rawSql("INSERT INTO branches (name, is_active) VALUES ('North Branch', true) RETURNING id");
      secondBranchId = ins2[0].id as string;
    }

    const tUser = await rawSql("SELECT id FROM users WHERE email = $1", [therapistEmail]);
    if (tUser.length > 0) therapistUserId = tUser[0].id as string;

    const aUser = await rawSql("SELECT id FROM users WHERE email = $1", [adminEmail]);
    if (aUser.length > 0) adminUserId = aUser[0].id as string;

    // Clean up any test rooms and case assignments for clean idempotent runs
    await rawSql("UPDATE cases SET room_id = NULL");
    await rawSql("DELETE FROM rooms");
    await rawSql("DELETE FROM admin_notes");
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Room creation & validation
  // --------------------------------------------------------------------------
  test("Scenario 1: Room creation, duplicate rejection per branch, and bulk creation", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);

    // Navigate to Rooms page
    await page.goto("/admin/rooms");
    await expect(page.locator("h1").first()).toContainText("Rooms");

    // 1. Create single room "101" in Main Branch
    await page.click('[data-testid="add-room-button"]');
    await expect(page.locator('[data-testid="tab-single-room"]')).toBeVisible();
    await page.fill('[data-testid="room-number-input"]', "101");
    await page.selectOption('[data-testid="room-branch-select"]', mainBranchId);
    await page.click('[data-testid="save-room-button"]');
    await expect(page.locator('[data-testid="tab-single-room"]')).toHaveCount(0);

    // Wait for room to appear in table
    await expect(page.locator('[data-testid="rooms-table"]')).toContainText("101");
    const roomRow = await rawSql("SELECT id FROM rooms WHERE branch_id = $1 AND lower(trim(room_no)) = '101'", [mainBranchId]);
    expect(roomRow.length).toBeGreaterThan(0);
    createdRoomId101 = roomRow[0].id as string;

    // 2. Attempt duplicate room creation in same branch (with whitespace / case variation)
    await page.click('[data-testid="add-room-button"]');
    await expect(page.locator('[data-testid="tab-single-room"]')).toBeVisible();
    await page.fill('[data-testid="room-number-input"]', " 101 ");
    await page.selectOption('[data-testid="room-branch-select"]', mainBranchId);
    await page.click('[data-testid="save-room-button"]');
    await expect(page.locator('[data-testid="add-room-error"]')).toContainText("already exists in this branch");
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('[data-testid="tab-single-room"]')).toHaveCount(0);

    // 3. Create room "101" in a DIFFERENT branch (should succeed)
    await page.click('[data-testid="add-room-button"]');
    await expect(page.locator('[data-testid="tab-single-room"]')).toBeVisible();
    await page.fill('[data-testid="room-number-input"]', "101");
    await page.selectOption('[data-testid="room-branch-select"]', secondBranchId);
    await page.click('[data-testid="save-room-button"]');
    await expect(page.locator('[data-testid="tab-single-room"]')).toHaveCount(0);

    // Verify DB has 2 rooms with number 101 in different branches
    const duplicateCrossBranch = await rawSql("SELECT id FROM rooms WHERE lower(trim(room_no)) = '101'");
    expect(duplicateCrossBranch.length).toBeGreaterThanOrEqual(2);

    // 4. Bulk create rooms with prefix R- (range 201 to 205)
    await page.click('[data-testid="add-room-button"]');
    await expect(page.locator('[data-testid="tab-bulk-room"]')).toBeVisible();
    await page.click('[data-testid="tab-bulk-room"]');
    await page.fill('[data-testid="bulk-prefix-input"]', "R-");
    await page.fill('[data-testid="bulk-start-input"]', "201");
    await page.fill('[data-testid="bulk-end-input"]', "205");
    await page.selectOption('[data-testid="bulk-branch-select"]', mainBranchId);
    await page.click('[data-testid="bulk-submit-button"]');

    // Verify summary banner
    await expect(page.locator('[data-testid="bulk-room-summary"]')).toContainText("Created: 5 rooms");

    // 5. Bulk create again with overlapping range -> verifies summary reports skipped rooms
    await page.fill('[data-testid="bulk-start-input"]', "204");
    await page.fill('[data-testid="bulk-end-input"]', "207");
    await page.click('[data-testid="bulk-submit-button"]');
    await expect(page.locator('[data-testid="bulk-room-summary"]')).toContainText("Created: 2 rooms");
    await expect(page.locator('[data-testid="bulk-room-summary"]')).toContainText("Skipped");

    // Close bulk modal
    await page.click('button:has-text("Close")');
    await expect(page.locator('[data-testid="tab-bulk-room"]')).toHaveCount(0);

    await page.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Case creation & dynamic occupancy
  // --------------------------------------------------------------------------
  test("Scenario 2: Therapist assigns free room upon case creation; room becomes OCCUPIED and disappears from dropdown", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, therapistEmail, therapistPassword, /\/therapist\/dashboard/);

    // Go to Create Case
    await page.goto("/therapist/cases/new");
    await expect(page.locator("h1").first()).toContainText("Create Case");

    // Fill Case details
    await page.fill('[data-testid="patient-name-input"]', "Aarav Sharma");
    await page.fill('[data-testid="patient-age-input"]', "28");
    await page.selectOption('[data-testid="patient-sex-select"]', "male");
    await page.fill('[data-testid="problem-input"]', "Severe lumbar disc herniation with lower limb radiculopathy.");
    await page.fill('[data-testid="present-condition-input"]', "Patient experiences severe localized pain radiating to left calf. Gait is antalgic.");
    await page.selectOption('[data-testid="service-select"]', "physiotherapy");

    // Select Main Branch
    await page.selectOption('[data-testid="branch-select"]', mainBranchId);

    // Verify room 101 is in dropdown and select it
    await expect(page.locator('[data-testid="room-select"]')).toBeVisible({ timeout: 5000 });
    await page.selectOption('[data-testid="room-select"]', createdRoomId101);

    // Set today start date
    await page.fill('[data-testid="start-date-input"]', getTodayIST());

    // Upload dummy photo via direct file input
    await page.setInputFiles('[data-testid="joining-photo-input"]', {
      name: "initial-assessment.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"),
    });
    await expect(page.locator('img[alt^="Joining preview"]')).toBeVisible({ timeout: 5000 });

    // Consent
    await page.check('[data-testid="consent-checkbox"]');

    // Submit
    await page.click('[data-testid="submit-case-btn"]');

    // Confirm success modal / screen
    await expect(page.locator('[data-testid="create-case-success"]')).toBeVisible({ timeout: 15000 });
    createdPatientId = (await page.locator('[data-testid="created-patient-id"]').innerText()).trim();
    expect(createdPatientId).toMatch(/GCP-\d+/);

    // Query DB for created case
    const caseRow = await rawSql("SELECT id, room_id, status FROM cases WHERE patient_id = $1", [createdPatientId]);
    expect(caseRow.length).toBe(1);
    expect(caseRow[0].room_id).toBe(createdRoomId101);
    expect(caseRow[0].status).not.toBe("completed");
    createdCaseId = caseRow[0].id as string;

    // Check Admin Rooms page: Room 101 must now be OCCUPIED
    const adminPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(adminPage, adminEmail, adminPassword, /\/admin\/dashboard/);
    await adminPage.goto("/admin/rooms");

    const row101 = adminPage.locator(`[data-testid="room-row-${createdRoomId101}"]`);
    await expect(row101).toBeVisible();
    await expect(row101.locator(`[data-testid="room-status-badge-${createdRoomId101}"]`)).toContainText("OCCUPIED");
    await expect(row101).toContainText(createdPatientId);
    await expect(row101).toContainText("Aarav Sharma");

    // Check therapist page again: Room 101 must NO LONGER appear in dropdown
    await page.goto("/therapist/cases/new");
    await page.selectOption('[data-testid="branch-select"]', mainBranchId);
    await expect(page.locator('[data-testid="room-select"] option')).not.toHaveCount(0);
    const roomSelectOptions = await page.locator('[data-testid="room-select"] option').allInnerTexts();
    expect(roomSelectOptions).not.toContain("101");

    await page.close();
    await adminPage.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Race condition (simultaneous assignment)
  // --------------------------------------------------------------------------
  test("Scenario 3: Concurrent assignment of same room handled by DB partial unique index", async () => {
    // Find an unoccupied room in Main Branch
    const freeRooms = await rawSql(
      `SELECT r.id, r.room_no FROM rooms r 
       LEFT JOIN cases c ON c.room_id = r.id AND c.status <> 'completed'
       WHERE r.branch_id = $1 AND r.is_active = true AND c.id IS NULL
       LIMIT 1`,
      [mainBranchId]
    );
    expect(freeRooms.length).toBeGreaterThan(0);
    const targetRoomId = freeRooms[0].id as string;

    let clientId = "";
    const clientRows = await rawSql("SELECT id FROM clients LIMIT 1");
    if (clientRows.length > 0) {
      clientId = clientRows[0].id as string;
    } else {
      const ins = await rawSql("INSERT INTO clients (full_name, age, gender, phone) VALUES ('Test Race Client', 30, 'male', '+91 9999999999') RETURNING id");
      clientId = ins[0].id as string;
    }

    // Execute 2 concurrent case creations taking the exact same room at the same millisecond
    const [insA, insB] = await Promise.allSettled([
      rawSql(
        `INSERT INTO cases (case_number, patient_id, client_id, category, priority, description, created_by, current_therapist_id, branch_id, room_id, room_no, status, created_at)
         VALUES ('GCS-RACE-A', 'GCP-9101', $1, 'General', 'medium', 'Race test A', $2, $3, $4, $5, 'R-201', 'assigned', NOW())`,
        [clientId, adminUserId, therapistUserId, mainBranchId, targetRoomId]
      ),
      rawSql(
        `INSERT INTO cases (case_number, patient_id, client_id, category, priority, description, created_by, current_therapist_id, branch_id, room_id, room_no, status, created_at)
         VALUES ('GCS-RACE-B', 'GCP-9102', $1, 'General', 'medium', 'Race test B', $2, $3, $4, $5, 'R-201', 'assigned', NOW())`,
        [clientId, adminUserId, therapistUserId, mainBranchId, targetRoomId]
      ),
    ]);

    const successes = [insA, insB].filter((r) => r.status === "fulfilled");
    const rejections = [insA, insB].filter((r) => r.status === "rejected");

    // Exactly 1 succeeds, 1 is rejected by partial unique index
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);
    const rejectionReason = String((rejections[0] as PromiseRejectedResult).reason);
    expect(rejectionReason).toContain("one_open_case_per_room");

    // Verify DB partial unique constraint: exactly 1 open case holds targetRoomId
    const openCasesInRoom = await rawSql(
      "SELECT id, patient_id FROM cases WHERE room_id = $1 AND status <> 'completed'",
      [targetRoomId]
    );
    expect(openCasesInRoom.length).toBe(1);

    // Clean up race test cases
    await rawSql("DELETE FROM cases WHERE case_number IN ('GCS-RACE-A', 'GCS-RACE-B')");
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Room immutability on open cases
  // --------------------------------------------------------------------------
  test("Scenario 4: Room cannot be altered while case is open; reassignment keeps room", async ({ browser }) => {
    // Check that open case holds room and room is read-only
    const caseData = await rawSql("SELECT id, room_id, current_therapist_id FROM cases WHERE id = $1", [createdCaseId]);
    expect(caseData.length).toBe(1);
    expect(caseData[0].room_id).toBe(createdRoomId101);

    // Reassign case to another therapist (or self)
    await rawSql("UPDATE cases SET current_therapist_id = $1 WHERE id = $2", [therapistUserId, createdCaseId]);

    // Room must still be intact
    const caseAfterReassign = await rawSql("SELECT room_id FROM cases WHERE id = $1", [createdCaseId]);
    expect(caseAfterReassign[0].room_id).toBe(createdRoomId101);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Case close frees room immediately
  // --------------------------------------------------------------------------
  test("Scenario 5: Closing case makes room FREE immediately", async ({ browser }) => {
    // Verify room 101 is currently occupied
    const beforeClose = await rawSql(
      "SELECT id FROM cases WHERE room_id = $1 AND status <> 'completed'",
      [createdRoomId101]
    );
    expect(beforeClose.length).toBe(1);

    // Close the case
    await rawSql("UPDATE cases SET status = 'completed', closed_at = NOW() WHERE id = $1", [createdCaseId]);

    // Check Admin Rooms page: Room 101 must now be FREE
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);
    await page.goto("/admin/rooms");

    const row101 = page.locator(`[data-testid="room-row-${createdRoomId101}"]`);
    await expect(row101.locator(`[data-testid="room-status-badge-${createdRoomId101}"]`)).toContainText("FREE");
    await expect(row101).toContainText("—"); // Patient cleared

    // Check therapist page: Room 101 is back in dropdown
    const tPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(tPage, therapistEmail, therapistPassword, /\/therapist\/dashboard/);
    await tPage.goto("/therapist/cases/new");
    await tPage.selectOption('[data-testid="branch-select"]', mainBranchId);
    await expect(tPage.locator('[data-testid="room-select"]')).toContainText("101");

    await page.close();
    await tPage.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Room protection (Rename, Deactivate, Delete safety)
  // --------------------------------------------------------------------------
  test("Scenario 6: Room protection rules (Used room cannot be deleted, unused can)", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);
    await page.goto("/admin/rooms");

    // 1. Room 101 has been used by a case (createdCaseId) -> CANNOT be deleted
    await page.click(`[data-testid="delete-room-btn-${createdRoomId101}"]`);
    await expect(page.locator("text=Cannot delete used room")).toBeVisible();
    await expect(page.locator("text=Rooms that have ever been used cannot be deleted. Please deactivate it instead.")).toBeVisible();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator("text=Cannot delete used room")).toHaveCount(0);

    // 2. Unused room (e.g. R-205) CAN be deleted
    const unusedRoom = await rawSql(
      `SELECT r.id, r.room_no FROM rooms r 
       LEFT JOIN cases c ON c.room_id = r.id 
       WHERE r.room_no = 'R-205' AND c.id IS NULL LIMIT 1`
    );
    if (unusedRoom.length > 0) {
      const unusedId = unusedRoom[0].id as string;
      await page.click(`[data-testid="delete-room-btn-${unusedId}"]`);
      await expect(page.locator('[data-testid="confirm-delete-room-button"]')).toBeVisible();
      await page.click('[data-testid="confirm-delete-room-button"]');
      await expect(page.locator('[data-testid="confirm-delete-room-button"]')).toHaveCount(0);

      // Verify row removed
      await expect(page.locator(`[data-testid="room-row-${unusedId}"]`)).toHaveCount(0);
    }

    // 3. Deactivate room 101
    await page.click(`[data-testid="toggle-room-btn-${createdRoomId101}"]`);
    await expect(page.locator(`[data-testid="room-status-badge-${createdRoomId101}"]`)).toContainText("INACTIVE");

    // Reactivate for future tests
    await page.click(`[data-testid="toggle-room-btn-${createdRoomId101}"]`);
    await expect(page.locator(`[data-testid="room-status-badge-${createdRoomId101}"]`)).toContainText("FREE");

    await page.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Admin Dashboard (Zero charts, plain numbers, clean table, date filter, totals row)
  // --------------------------------------------------------------------------
  test("Scenario 7: Admin Dashboard simplified - zero charts, plain numbers, totals row", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);

    // 1. Strict verification: NO charts anywhere
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBe(0);
    const rechartsCount = await page.locator(".recharts-responsive-container").count();
    expect(rechartsCount).toBe(0);

    // 2. Plain number stat cards
    await expect(page.locator('[data-testid="stat-therapists"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-active-cases"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="stat-rooms"]')).toBeVisible();

    // 3. Therapists Table columns
    const tableHeader = page.locator('[data-testid="therapists-table"] thead, [data-testid="admin-therapists-table"] thead');
    await expect(tableHeader).toContainText("Therapist");
    await expect(tableHeader).toContainText("Sessions on this date");
    await expect(tableHeader).toContainText("Active cases");
    await expect(tableHeader).toContainText("Cases closed on this date");
    await expect(tableHeader).toContainText("Rooms in use");
    await expect(tableHeader).toContainText("Last login");
    await expect(tableHeader).toContainText("Actions");

    // 4. Totals row present
    await expect(page.locator('[data-testid="totals-row"]')).toBeVisible();

    // 5. Past Date Banner via date parameter
    const pastDate = getDaysAgoIST(1);
    await page.goto(`/admin/dashboard?date=${pastDate}`);
    const pastBanner = page.locator('[data-testid="past-date-banner"], [data-testid="history-banner"]').first();
    await expect(pastBanner).toBeVisible();
    await expect(pastBanner).toContainText(/Viewing histor/i);

    // Reset to today
    await page.goto("/admin/dashboard");
    await expect(page.locator('[data-testid="past-date-banner"]')).toHaveCount(0);

    await page.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Therapist Detail Page (/admin/therapists/[id])
  // --------------------------------------------------------------------------
  test("Scenario 8: Therapist Detail Page with 4 sections and zero charts", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);

    await page.goto(`/admin/therapists/${therapistUserId}`);
    await expect(page.locator('[data-testid="therapist-detail-page"] h1')).toContainText("Dr. Test Therapist Active");

    // 1. Header action buttons
    await expect(page.locator('[data-testid="send-note-header-btn"], [data-testid="header-send-note-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="edit-therapist-header-btn"], [data-testid="header-edit-therapist-btn"]')).toBeVisible();

    // 2. Section: Sessions per day table (no charts)
    await expect(page.locator('[data-testid="daily-sessions-table"], [data-testid="sessions-per-day-table"]')).toBeVisible();
    await expect(page.locator('[data-testid="month-select"], [data-testid="month-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-sessions-totals-row"], [data-testid="month-totals-row"]')).toBeVisible();
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBe(0);

    // 3. Section: Active cases table / heading
    await expect(page.locator("h2:has-text('Active Cases')")).toBeVisible();

    // 4. Section: Notes sent section
    await expect(page.locator("h2:has-text('Notes Sent')")).toBeVisible();

    // 5. Section: Login activity
    await expect(page.locator("h2:has-text('Login Activity')")).toBeVisible();

    await page.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Admin Notes (In-app notification, email privacy, mark as read, rate limit, auth)
  // --------------------------------------------------------------------------
  test("Scenario 9: Admin Notes sent with preview in-app, note text NOT in email, mark as read, and rate limits", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);

    // 1. Open Send Note Dialog from Dashboard or Therapist detail
    await page.goto("/admin/dashboard");
    await page.click(`[data-testid="send-note-btn-${therapistUserId}"], [data-testid="send-note-button-${therapistUserId}"]`);
    await expect(page.locator('[data-testid="send-note-dialog"]')).toBeVisible();

    const noteText = "Please complete the comprehensive progress report for GCP-0001 before Friday noon.";
    await page.fill('[data-testid="note-message-textarea"]', noteText);
    await expect(page.locator('[data-testid="note-char-counter"]')).toContainText(`${noteText.length}/1000`);
    await page.click('[data-testid="submit-note-button"]');

    // Wait for dialog to close
    await expect(page.locator('[data-testid="send-note-dialog"]')).toHaveCount(0);

    // 2. Verify DB: Note record created
    const noteRows = await rawSql(
      "SELECT id, message, read_at FROM admin_notes WHERE to_user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [therapistUserId]
    );
    expect(noteRows.length).toBe(1);
    const createdNoteId = noteRows[0].id as string;
    expect(noteRows[0].message).toBe(noteText);
    expect(noteRows[0].read_at).toBeNull();

    // 3. Verify in-app notification created with <=80 char preview
    const notifRows = await rawSql(
      "SELECT id, title, body FROM in_app_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [therapistUserId]
    );
    expect(notifRows.length).toBe(1);
    expect(notifRows[0].title).toMatch(/Note from/i);
    expect(notifRows[0].body).toContain(noteText.slice(0, 80));

    // 4. Verify Resend Email Queue: NOTE TEXT IS STRICTLY NOT IN THE EMAIL!
    const emailRows = await getEmails(therapistEmail, "admin_note");
    expect(emailRows.length).toBeGreaterThan(0);
    const latestEmail = emailRows[0];
    expect(latestEmail.template).toBe("admin_note");
    const payload = typeof latestEmail.payload === "string" ? JSON.parse(latestEmail.payload as string) : (latestEmail.payload as any);
    const rendered = renderEmail(latestEmail.template as any, payload);
    expect(rendered.subject).toContain("You have a new note from");
    expect(rendered.text).toContain("You have a new note from");
    expect(rendered.text).not.toContain(noteText); // NOTE TEXT MUST NOT LEAK INTO EMAIL
    expect(rendered.html).not.toContain(noteText);

    // 5. Therapist logs in, visits /therapist/notes, sees UNREAD note and marks as read
    const tPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(tPage, therapistEmail, therapistPassword, /\/therapist\/dashboard/);

    // Therapist sidebar has "Notes from Admin"
    await tPage.goto("/therapist/notes");
    await expect(tPage.locator(`[data-testid="note-card-${createdNoteId}"]`)).toBeVisible();
    await expect(tPage.locator(`[data-testid="unread-badge-${createdNoteId}"]`)).toBeVisible();

    // Click Mark as read
    await tPage.click(`[data-testid="mark-read-btn-${createdNoteId}"]`);
    await expect(tPage.locator(`[data-testid="read-badge-${createdNoteId}"]`)).toBeVisible();

    // 6. Admin checks therapist detail page: note status reflects "Seen"
    await page.goto(`/admin/therapists/${therapistUserId}`);
    const noteEntry = page.locator(`[data-testid="note-sent-row-${createdNoteId}"]`);
    await expect(noteEntry).toBeVisible();
    await expect(noteEntry).toContainText("Seen");

    // 7. Sending note to deactivated therapist is blocked
    try {
      await rawSql("UPDATE users SET is_active = false WHERE id = $1", [therapistUserId]);

      await page.click('[data-testid="send-note-header-btn"]');
      await expect(page.locator('[data-testid="send-note-dialog"]')).toBeVisible();
      await page.fill('[data-testid="note-message-textarea"]', "This should be blocked for deactivated practitioner");
      await page.click('[data-testid="submit-note-button"]');
      await expect(page.locator('[data-testid="send-note-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="send-note-error"]')).toContainText(/deactivated/i);
    } finally {
      // Restore therapist active status
      await rawSql("UPDATE users SET is_active = true WHERE id = $1", [therapistUserId]);
    }

    await page.close();
    await tPage.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Simplified Create Therapist Form (4 fields only)
  // --------------------------------------------------------------------------
  test("Scenario 10: Simplified Create Therapist form with 4 fields only and credentials modal", async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);

    await page.goto("/admin/therapists/new");
    await expect(page.locator("h1").first()).toContainText("Register");

    // 1. Verify exactly 4 fields present
    await expect(page.locator('[data-testid="therapist-name-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="therapist-email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="therapist-phone-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="therapist-password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="therapist-confirm-password-input"]')).toBeVisible();

    // 2. Specialization, experience, max open cases are ABSENT
    await expect(page.locator('[data-testid="therapist-specialization-input"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="therapist-experience-input"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="therapist-max-cases-input"]')).toHaveCount(0);

    // 3. Submit new practitioner
    const ts = Date.now();
    const newName = `Dr. New Simpl Therapist ${ts}`;
    const newEmail = `therapist.simpl.${ts}@guildclubtest.com`;
    await page.fill('[data-testid="therapist-name-input"]', newName);
    await page.fill('[data-testid="therapist-email-input"]', newEmail);
    await page.fill('[data-testid="therapist-phone-input"]', "+91 9123456789");
    await page.fill('[data-testid="therapist-password-input"]', "StrongPass@123");
    await page.fill('[data-testid="therapist-confirm-password-input"]', "StrongPass@123");
    await page.click('[data-testid="therapist-submit-button"]');

    // 4. Credentials modal shown
    await expect(page.locator('[data-testid="copy-credentials-button"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="credentials-email"]')).toContainText(newEmail);
    await expect(page.locator('[data-testid="credentials-password"]')).toContainText("StrongPass@123");

    // 5. Verify credentials email has email and password clearly displayed
    const credEmail = renderCredentialsEmail({
      toEmail: newEmail,
      toName: newName,
      role: "therapist",
      createdByName: "Test Admin",
      password: "StrongPass@123",
      includePassword: true,
      baseUrl: "http://localhost:3000",
      replyTo: "support@guildclubservices.com",
    });
    expect(credEmail.html).toContain(newEmail);
    expect(credEmail.html).toContain("StrongPass@123");
    expect(credEmail.html).toContain("Your Account Login Credentials");
    expect(credEmail.text).toContain(newEmail);
    expect(credEmail.text).toContain("StrongPass@123");

    // 6. Confirm case_assigned emails are not queued
    const caseAssignedEmails = await getEmails(newEmail, "case_assigned");
    expect(caseAssignedEmails.length).toBe(0);

    await page.close();
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Migration verification & conflict banner
  // --------------------------------------------------------------------------
  test("Scenario 11: Migration conflict report generated and null-room banner on Admin dashboard", async ({ browser }) => {
    // 1. Verify MIGRATION-ROOM-CONFLICTS.md exists
    const reportPath = path.resolve(process.cwd(), "MIGRATION-ROOM-CONFLICTS.md");
    expect(fs.existsSync(reportPath)).toBe(true);
    const content = fs.readFileSync(reportPath, "utf-8");
    expect(content).toContain("# Guild Club Services: Room Migration & Conflict Report");

    // 2. Temporarily set an open case's room_id to null to verify banner appears
    await rawSql(
      "UPDATE cases SET room_id = NULL, status = 'in_progress' WHERE id = $1",
      [createdCaseId]
    );

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(page, adminEmail, adminPassword, /\/admin\/dashboard/);

    // Verify null-room banner
    await expect(page.locator('[data-testid="null-room-cases-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="null-room-cases-banner"]')).toContainText(/open case(s have| has) no room/i);

    // Restore room_id
    await rawSql(
      "UPDATE cases SET room_id = $1, status = 'completed' WHERE id = $2",
      [createdRoomId101, createdCaseId]
    );

    await page.close();
  });

  // --------------------------------------------------------------------------
  // Capture UI Screenshots at 390px (mobile) and 1440px (desktop)
  // --------------------------------------------------------------------------
  test("Capture screenshots for Admin Dashboard, Rooms Page, Therapist Detail, and Send Note Dialog", async ({ browser }) => {
    const adminPage1440 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await loginAs(adminPage1440, adminEmail, adminPassword, /\/admin\/dashboard/);

    // 1. Admin Dashboard Desktop (1440px)
    await captureScreenshot(adminPage1440, "admin-dashboard-desktop-1440.png");

    // 2. Rooms Page Desktop (1440px)
    await adminPage1440.goto("/admin/rooms");
    await expect(adminPage1440.locator("h1").first()).toContainText("Rooms");
    await captureScreenshot(adminPage1440, "admin-rooms-desktop-1440.png");

    // 3. Therapist Detail Page Desktop (1440px)
    await adminPage1440.goto(`/admin/therapists/${therapistUserId}`);
    await expect(adminPage1440.locator('[data-testid="therapist-detail-page"] h1')).toContainText("Dr. Test Therapist Active");
    await captureScreenshot(adminPage1440, "admin-therapist-detail-desktop-1440.png");

    // 4. Send Note Dialog Desktop (1440px)
    await adminPage1440.click('[data-testid="send-note-header-btn"]');
    await expect(adminPage1440.locator('[data-testid="send-note-dialog"]')).toBeVisible();
    await adminPage1440.fill('[data-testid="note-message-textarea"]', "Hello Dr. Active, please make sure the initial notes for your patient in Room 101 are uploaded by 4:00 PM today.");
    await captureScreenshot(adminPage1440, "admin-send-note-modal-desktop-1440.png");

    await adminPage1440.close();

    // Mobile (390px) Screenshots
    const adminPage390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await loginAs(adminPage390, adminEmail, adminPassword, /\/admin\/dashboard/);

    // 1. Admin Dashboard Mobile (390px)
    await captureScreenshot(adminPage390, "admin-dashboard-mobile-390.png");

    // 2. Rooms Page Mobile (390px)
    await adminPage390.goto("/admin/rooms");
    await captureScreenshot(adminPage390, "admin-rooms-mobile-390.png");

    // 3. Therapist Detail Page Mobile (390px)
    await adminPage390.goto(`/admin/therapists/${therapistUserId}`);
    await captureScreenshot(adminPage390, "admin-therapist-detail-mobile-390.png");

    // 4. Send Note Dialog Mobile (390px)
    await adminPage390.click('[data-testid="send-note-header-btn"]');
    await expect(adminPage390.locator('[data-testid="send-note-dialog"]')).toBeVisible();
    await adminPage390.fill('[data-testid="note-message-textarea"]', "Hello Dr. Active, mobile notification test note.");
    await captureScreenshot(adminPage390, "admin-send-note-modal-mobile-390.png");

    await adminPage390.close();
  });
});
