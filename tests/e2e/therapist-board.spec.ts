import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import path from "path";
import fs from "fs";
import { assertTestDatabase } from "../helpers/stage2-helpers";
import { getTodayIST, getYesterdayIST } from "../../src/lib/date-utils";
import { seedDemoSessions } from "../../scripts/seed-demo-sessions";

const authDir = path.resolve(process.cwd(), "playwright/.auth");
const screenshotsDir = path.resolve(process.cwd(), "test-results/screenshots-ui");

// 1x1 PNG transparent pixel buffer for mock uploads
const dummyPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

test.describe.serial("TSB: Therapist Session Board & Clinical Verification", () => {
  let therapistId = "";
  let therapistEmail = "";
  let otherTherapistId = "";
  let otherTherapistEmail = "";
  let adminId = "";
  let testCaseId = "";
  let testCaseNumber = "";
  let todayIST = "";
  let yesterdayIST = "";
  let activeSessionId = "";
  let otherSessionId = "";
  let pastSessionId = "";

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const sql = neon(assertTestDatabase());
    todayIST = getTodayIST();
    yesterdayIST = getYesterdayIST();

    // 1. Get seeded users (specifically test.therapist@guildclub.com matching therapist.json)
    const thRows = await sql`
      SELECT id, email FROM users WHERE email = 'test.therapist@guildclub.com' LIMIT 1
    `;
    therapistId = thRows[0].id;
    therapistEmail = thRows[0].email;

    const otherThRows = await sql`
      SELECT id, email FROM users WHERE role = 'therapist' AND email != 'test.therapist@guildclub.com' LIMIT 1
    `;
    if (otherThRows.length > 0) {
      otherTherapistId = otherThRows[0].id;
      otherTherapistEmail = otherThRows[0].email;
    } else {
      // Create a secondary therapist for cross-tenant authorization testing
      const newTh = await sql`
        INSERT INTO users (name, email, password_hash, role)
        VALUES ('Dr. Other Therapist', 'other.therapist@test.com', 'hashedpwd', 'therapist')
        RETURNING id, email
      `;
      otherTherapistId = newTh[0].id;
      otherTherapistEmail = newTh[0].email;
    }

    const adminRows = await sql`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `;
    adminId = adminRows[0].id;

    // 2. Insert Client
    const clientRows = await sql`
      INSERT INTO clients (full_name, age, gender, phone, email)
      VALUES ('Aarav Sharma', 29, 'Male', '+91 9811122233', 'aarav.sharma@test.com')
      RETURNING id
    `;
    const clientId = clientRows[0].id;

    // 3. Insert Case
    const currentYear = new Date().getFullYear();
    testCaseNumber = `GCS-${currentYear}-7701`;
    const caseRows = await sql`
      INSERT INTO cases (case_number, client_id, category, priority, description, status, created_by, current_therapist_id)
      VALUES (${testCaseNumber}, ${clientId}, 'Cognitive Behavioral Therapy', 'high', 'Patient undergoing CBT treatment sessions', 'in_progress', ${adminId}, ${therapistId})
      ON CONFLICT (case_number) DO UPDATE SET status = 'in_progress'
      RETURNING id
    `;
    testCaseId = caseRows[0].id;

    // 4. Assign Room for Today
    await sql`
      INSERT INTO therapist_room_assignments (therapist_id, assigned_date, room_no, created_by)
      VALUES (${therapistId}, ${todayIST}, 'Room 204', ${adminId})
      ON CONFLICT (therapist_id, assigned_date)
      DO UPDATE SET room_no = 'Room 204'
    `;

    // 5. Clean prior sessions for this case/date
    await sql`
      DELETE FROM sessions WHERE case_id = ${testCaseId}
    `;

    // 6. Seed 10 Sessions for Today (2 completed, 8 pending)
    // Times from 09:00 to 18:00 IST
    for (let i = 0; i < 10; i++) {
      const hour = 9 + i;
      const hourStr = String(hour).padStart(2, "0");
      // IST time into UTC timestamp
      const scheduledUtc = new Date(`${todayIST}T${hourStr}:00:00+05:30`);
      const isHeld = i < 2;

      const [sess] = await sql`
        INSERT INTO sessions (case_id, therapist_id, scheduled_at, status, notes)
        VALUES (
          ${testCaseId},
          ${therapistId},
          ${scheduledUtc},
          ${isHeld ? "held" : "scheduled"},
          ${isHeld ? "Completed morning consultation" : `Session slot ${i + 1}`}
        )
        RETURNING id
      `;

      if (i === 2) {
        activeSessionId = sess.id; // Target session for interactive workflow test
      }
    }

    // 7. Seed Past Session (Yesterday) in pending state
    const yesterdayUtc = new Date(`${yesterdayIST}T10:00:00+05:30`);
    const [pastSess] = await sql`
      INSERT INTO sessions (case_id, therapist_id, scheduled_at, status, notes)
      VALUES (${testCaseId}, ${therapistId}, ${yesterdayUtc}, 'scheduled', 'Past scheduled session')
      RETURNING id
    `;
    pastSessionId = pastSess.id;

    // 8. Seed Session for Other Therapist
    const otherSessUtc = new Date(`${todayIST}T11:00:00+05:30`);
    const [otherSess] = await sql`
      INSERT INTO sessions (case_id, therapist_id, scheduled_at, status, notes)
      VALUES (${testCaseId}, ${otherTherapistId}, ${otherSessUtc}, 'scheduled', 'Other therapist session')
      RETURNING id
    `;
    otherSessionId = otherSess.id;
  });

  // TSB-01: Grid Layout and Room Display
  test("TSB-01: Session grid displays 10 blocks, room assignment, legend and 5 per row on desktop", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    // Header room display
    const roomLabel = page.getByTestId("assigned-room-label");
    await expect(roomLabel).toBeVisible();
    await expect(roomLabel).toContainText(/assigned room:\s*room 204/i);

    // Legend & counters: Pending: 8, Completed: 2
    const legend = page.getByTestId("session-board-legend");
    await expect(legend).toBeVisible();
    await expect(legend).toContainText(/pending:\s*8/i);
    await expect(legend).toContainText(/completed:\s*2/i);

    // Grid blocks count
    const blocks = page.getByTestId("session-block");
    await expect(blocks).toHaveCount(10);

    // Verify data-status attribute & labels
    const pendingBlocks = page.locator('[data-testid="session-block"][data-status="pending"]');
    const completedBlocks = page.locator('[data-testid="session-block"][data-status="completed"]');
    await expect(pendingBlocks).toHaveCount(8);
    await expect(completedBlocks).toHaveCount(2);

    await expect(pendingBlocks.first()).toContainText(/pending/i);
    await expect(completedBlocks.first()).toContainText(/completed/i);

    // Capture desktop full page screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "therapist-board-desktop-1440.png"),
      fullPage: true,
    });

    await context.close();
  });

  // TSB-02: Responsive Grid at Mobile 390px (2 per row)
  test("TSB-02: Session grid renders 2 per row on mobile (390px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    const grid = page.getByTestId("session-grid");
    await expect(grid).toBeVisible();

    // Verify grid CSS classes contain mobile 2 columns
    await expect(grid).toHaveClass(/grid-cols-2/);

    const blocks = page.getByTestId("session-block");
    await expect(blocks).toHaveCount(10);

    // Capture mobile full page screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "therapist-board-mobile-390.png"),
      fullPage: true,
    });

    // Also open drawer on mobile to verify full-screen sheet and capture screenshot
    await blocks.first().click();
    await expect(page.getByTestId("session-drawer")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "therapist-drawer-open-390.png"),
      fullPage: true,
    });

    await context.close();
  });

  // TSB-03: Tablet Grid at 768px (3 per row)
  test("TSB-03: Session grid renders 3 per row on tablet (768px)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    const grid = page.getByTestId("session-grid");
    await expect(grid).toBeVisible();
    await expect(grid).toHaveClass(/md:grid-cols-3/);

    await page.screenshot({
      path: path.join(screenshotsDir, "therapist-board-tablet-768.png"),
      fullPage: true,
    });

    // Also open drawer on tablet to capture screenshot
    await page.getByTestId("session-block").first().click();
    await expect(page.getByTestId("session-drawer")).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotsDir, "therapist-drawer-open-768.png"),
      fullPage: true,
    });

    await context.close();
  });

  // TSB-04: Drawer Open with Patient Information
  test("TSB-04: Clicking a block opens drawer with correct patient name, age, and room", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    // Click the 3rd session block (activeSessionId)
    const targetBlock = page.locator(`[data-session-id="${activeSessionId}"]`);
    await targetBlock.click();

    // Drawer should open
    const drawer = page.getByTestId("session-drawer");
    await expect(drawer).toBeVisible();

    // Verify patient details
    await expect(page.getByTestId("session-drawer-patient-name")).toContainText("Aarav Sharma");
    await expect(page.getByTestId("session-drawer-patient-age")).toContainText("29");
    await expect(page.getByTestId("session-drawer-room")).toContainText("Room 204");

    // "Complete session" button is initially disabled
    const completeBtn = page.getByTestId("complete-session-button");
    await expect(completeBtn).toBeDisabled();

    // Capture drawer screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, "therapist-drawer-open-1440.png"),
      fullPage: true,
    });

    await context.close();
  });

  // TSB-05: Out-Time Photo is Blocked before In-Time Photo
  test("TSB-05: Out-time photo button is disabled until in-time photo is uploaded", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    await page.locator(`[data-session-id="${activeSessionId}"]`).click();
    await expect(page.getByTestId("session-drawer")).toBeVisible();

    // Out-time button should be disabled
    const outTimeBtn = page.getByTestId("out-time-photo-button");
    await expect(outTimeBtn).toBeDisabled();

    await context.close();
  });

  // TSB-06: Interactive Clinical Session Workflow (In-Time -> Work Done -> Out-Time -> Sign -> Complete)
  test("TSB-06: Full clinical session workflow: In-time photo, notes, out-time photo, signature and completion", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    await page.locator(`[data-session-id="${activeSessionId}"]`).click();
    await expect(page.getByTestId("session-drawer")).toBeVisible();

    const completeBtn = page.getByTestId("complete-session-button");

    // Step 1: Upload In-Time Photo
    const inPhotoInput = page.getByTestId("in-time-photo-input");
    await inPhotoInput.setInputFiles({
      name: "in-time.jpg",
      mimeType: "image/jpeg",
      buffer: dummyPngBuffer,
    });
    await expect(page.getByTestId("in-time-photo-preview")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("in-time-timestamp")).toBeVisible();

    // Complete button is still disabled (missing work done, out photo, signature)
    await expect(completeBtn).toBeDisabled();

    // Step 2: Enter Work Done notes (min 10 chars)
    const workDoneInput = page.getByTestId("work-done-input");
    await workDoneInput.fill("Explored cognitive distortion triggers; patient engaged in reframing exercises.");
    await page.getByTestId("work-done-save-button").click();
    await expect(page.locator("body")).toContainText(/draft saved/i, { timeout: 10000 });

    // Complete button is still disabled
    await expect(completeBtn).toBeDisabled();

    // Step 3: Out-Time Photo is now unlocked! Upload out-time photo
    const outPhotoInput = page.getByTestId("out-time-photo-input");
    await outPhotoInput.setInputFiles({
      name: "out-time.jpg",
      mimeType: "image/jpeg",
      buffer: dummyPngBuffer,
    });
    await expect(page.getByTestId("out-time-photo-preview")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("out-time-timestamp")).toBeVisible();

    // Complete button is still disabled (missing signature)
    await expect(completeBtn).toBeDisabled();

    // Step 4: Draw Patient Signature on Canvas
    const canvas = page.getByTestId("patient-signature-canvas");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 30, box.y + 30);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 60);
      await page.mouse.move(box.x + 180, box.y + 40);
      await page.mouse.up();
    }

    // Step 5: Now ALL 4 artifacts exist! Complete button becomes enabled
    await expect(completeBtn).toBeEnabled({ timeout: 10000 });

    // Click "Complete session"
    await completeBtn.click();

    // Drawer closes and block turns GREEN
    await expect(page.getByTestId("session-drawer")).toBeHidden({ timeout: 10000 });

    // Live counter updates without page reload: Completed: 3, Pending: 7
    const legend = page.getByTestId("session-board-legend");
    await expect(legend).toContainText(/completed:\s*3/i);
    await expect(legend).toContainText(/pending:\s*7/i);

    // Target block has updated to data-status="completed"
    const completedTargetBlock = page.locator(`[data-session-id="${activeSessionId}"]`);
    await expect(completedTargetBlock).toHaveAttribute("data-status", "completed");
    await expect(completedTargetBlock).toContainText(/completed/i);

    // Step 6: Reopening completed session opens read-only
    await completedTargetBlock.click();
    await expect(page.getByTestId("session-drawer")).toBeVisible();
    await expect(page.getByTestId("complete-session-button")).toBeHidden();
    await expect(page.locator("body")).toContainText(/session completed & signed/i);

    await context.close();
  });

  // TSB-07: Direct API Rejection when Requirements are Missing
  test("TSB-07: Server rejects completion via direct API call when requirements are missing", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });

    // Pick one of the pending sessions
    const sql = neon(assertTestDatabase());
    const [pendingSess] = await sql`
      SELECT id FROM sessions
      WHERE therapist_id = ${therapistId} AND status = 'scheduled'
      LIMIT 1
    `;

    const res = await context.request.post(`/api/sessions/${pendingSess.id}/complete`);
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/missing required/i);

    await context.close();
  });

  // TSB-08: Cross-Tenant Authorization: Therapist cannot access other therapist's files
  test("TSB-08: Therapist cannot access another therapist's private session files (403)", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });

    // Therapist attempts to read file of otherSessionId
    const res = await context.request.get(`/api/files/${otherSessionId}/in-time-photo`);
    expect(res.status()).toBe(403);

    await context.close();
  });

  // TSB-09: Unauthenticated File Access is Blocked (401)
  test("TSB-09: Private file URLs cannot be accessed when logged out (401)", async ({ browser }) => {
    // Unauthenticated context
    const context = await browser.newContext();

    const res = await context.request.get(`/api/files/${activeSessionId}/in-time-photo`);
    expect(res.status()).toBe(401);

    await context.close();
  });

  // TSB-10: Admin and Super Admin can View Session Files Read-Only
  test("TSB-10: Admin can view private session files read-only", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    });

    const res = await context.request.get(`/api/files/${activeSessionId}/in-time-photo`);
    // Completed session has file stored
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/image\//);

    await context.close();
  });

  // TSB-11: Past Date Sessions are Read-Only and Stay Red
  test("TSB-11: Past date displays 'Viewing history' banner, pending sessions stay red and cannot be edited", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto(`/therapist/dashboard?date=${yesterdayIST}`);

    // History banner visible
    await expect(page.getByTestId("history-banner")).toBeVisible();

    // Past session block is red with label "Not completed"
    const pastBlock = page.locator(`[data-session-id="${pastSessionId}"]`);
    await expect(pastBlock).toBeVisible();
    await expect(pastBlock).toHaveAttribute("data-status", "pending");
    await expect(pastBlock).toContainText(/not completed/i);

    // Open past session drawer
    await pastBlock.click();
    await expect(page.getByTestId("session-drawer")).toBeVisible();

    // Photo input and Complete button are disabled/hidden
    await expect(page.getByTestId("complete-session-button")).toBeHidden();
    await expect(page.getByTestId("in-time-photo-button")).toBeHidden();

    await context.close();
  });

  // TSB-12: Assign Room by Admin reflects on Therapist Dashboard
  test("TSB-12: Admin assigns room on Therapists page and therapist dashboard reflects the assigned room", async ({ browser }) => {
    const adminContext = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/therapists");

    // Click Assign Room button on therapist row
    const assignRoomBtn = adminPage.getByTestId(`assign-room-button-${therapistId}`);
    await expect(assignRoomBtn).toBeVisible();
    await assignRoomBtn.click();

    // Fill room number "Suite 401"
    const roomInput = adminPage.getByTestId("assign-room-input");
    await expect(roomInput).toBeVisible();
    await roomInput.fill("Suite 401");
    await adminPage.getByTestId("assign-room-submit-button").click();
    await expect(adminPage.getByTestId("assign-room-success-message")).toBeVisible({ timeout: 10000 });
    await adminContext.close();

    // Verify on therapist dashboard
    const therapistContext = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const thPage = await therapistContext.newPage();
    await thPage.goto("/therapist/dashboard");

    const roomLabel = thPage.getByTestId("assigned-room-label");
    await expect(roomLabel).toContainText(/assigned room:\s*suite 401/i, { timeout: 10000 });

    await therapistContext.close();
  });

  // TSB-13: Audit Events Verification
  test("TSB-13: Audit events session_check_in, session_check_out, session_signed, and session_held exist with therapist actor", async () => {
    const sql = neon(assertTestDatabase());

    // Check events for activeSessionId
    const events = await sql`
      SELECT event_type, actor_id, actor_role
      FROM case_events
      WHERE case_id = ${testCaseId}
      ORDER BY occurred_at ASC
    `;

    const eventTypes = events.map((e) => e.event_type);
    expect(eventTypes).toContain("session_check_in");
    expect(eventTypes).toContain("session_check_out");
    expect(eventTypes).toContain("session_signed");
    expect(eventTypes).toContain("session_held");

    // Verify actor is the therapist
    for (const ev of events.filter((e) => e.event_type.startsWith("session_"))) {
      expect(ev.actor_id).toBe(therapistId);
      expect(ev.actor_role).toBe("therapist");
    }
  });

  // TSB-14: Demo Seed Script Execution & Board Verification
  test("TSB-14: Seed demo sessions populates 10 sessions (3 green completed, 7 red pending) and Room 204", async ({ browser }) => {
    const sql = neon(assertTestDatabase());
    // Clean prior sessions for this therapist to isolate demo seed verification
    await sql`DELETE FROM sessions WHERE therapist_id = ${therapistId}`;

    // Run seedDemoSessions for this therapist
    await seedDemoSessions(therapistEmail);

    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/therapist/dashboard");

    // Verify room assignment
    const roomLabel = page.getByTestId("assigned-room-label");
    await expect(roomLabel).toContainText(/assigned room:\s*room 204/i, { timeout: 10000 });

    // Verify exactly 10 blocks are rendered
    const blocks = page.getByTestId("session-block");
    await expect(blocks).toHaveCount(10);

    // Verify 3 completed blocks (green) and 7 pending blocks (red)
    const completedBlocks = page.locator('[data-testid="session-block"][data-status="completed"]');
    const pendingBlocks = page.locator('[data-testid="session-block"][data-status="pending"]');
    await expect(completedBlocks).toHaveCount(3);
    await expect(pendingBlocks).toHaveCount(7);

    // Verify legend
    const legend = page.getByTestId("session-board-legend");
    await expect(legend).toContainText(/completed:\s*3/i);
    await expect(legend).toContainText(/pending:\s*7/i);

    await context.close();
  });

  // TSB-15: Exact Timezone Boundaries (00:05 IST and 23:55 IST)
  test("TSB-15: Sessions at 00:05 IST and 23:55 IST show on the correct day", async ({ browser }) => {
    const sql = neon(assertTestDatabase());

    // Clean prior test sessions for boundary testing
    await sql`DELETE FROM sessions WHERE case_id = ${testCaseId}`;

    // 1. Session at 00:05 IST today
    const earlyToday = new Date(`${todayIST}T00:05:00+05:30`);
    const [sessEarly] = await sql`
      INSERT INTO sessions (case_id, therapist_id, scheduled_at, status, notes)
      VALUES (${testCaseId}, ${therapistId}, ${earlyToday}, 'scheduled', 'Early midnight session')
      RETURNING id
    `;

    // 2. Session at 23:55 IST today
    const lateToday = new Date(`${todayIST}T23:55:00+05:30`);
    const [sessLate] = await sql`
      INSERT INTO sessions (case_id, therapist_id, scheduled_at, status, notes)
      VALUES (${testCaseId}, ${therapistId}, ${lateToday}, 'scheduled', 'Late night session')
      RETURNING id
    `;

    // 3. Session at 23:55 IST yesterday
    const lateYesterday = new Date(`${yesterdayIST}T23:55:00+05:30`);
    const [sessYesterday] = await sql`
      INSERT INTO sessions (case_id, therapist_id, scheduled_at, status, notes)
      VALUES (${testCaseId}, ${therapistId}, ${lateYesterday}, 'scheduled', 'Yesterday late session')
      RETURNING id
    `;

    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();

    // Check Today's board: Must show earlyToday and lateToday, but NOT sessYesterday
    await page.goto(`/therapist/dashboard?date=${todayIST}`);
    await expect(page.locator(`[data-session-id="${sessEarly.id}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-session-id="${sessLate.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-session-id="${sessYesterday.id}"]`)).toHaveCount(0);

    // Check Yesterday's board: Must show sessYesterday, but NOT earlyToday
    await page.goto(`/therapist/dashboard?date=${yesterdayIST}`);
    await expect(page.locator(`[data-session-id="${sessYesterday.id}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`[data-session-id="${sessEarly.id}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-session-id="${sessLate.id}"]`)).toHaveCount(0);

    await context.close();
  });

  // TSB-16: Isolation of Other Therapist's Sessions
  test("TSB-16: Sessions assigned to another therapist do not appear on this therapist's board", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto(`/therapist/dashboard?date=${todayIST}`);

    // otherSessionId is assigned to otherTherapistId, should NOT be on this board
    const otherBlock = page.locator(`[data-session-id="${otherSessionId}"]`);
    await expect(otherBlock).toHaveCount(0);

    await context.close();
  });

  // TSB-17: Empty State with Open Cases
  test("TSB-17: Empty state when therapist has cases but no sessions on selected date shows 'No sessions today. You have N open cases'", async ({ browser }) => {
    const sql = neon(assertTestDatabase());

    // Clear all sessions for this therapist today so totalSessions === 0, but case is in 'in_progress' status
    await sql`DELETE FROM sessions WHERE therapist_id = ${therapistId}`;
    await sql`UPDATE cases SET current_therapist_id = ${therapistId}, status = 'in_progress' WHERE id = ${testCaseId}`;

    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();
    await page.goto(`/therapist/dashboard?date=${todayIST}`);

    // Verify enhanced empty state
    const emptyState = page.getByTestId("no-sessions-empty-state");
    await expect(emptyState).toBeVisible({ timeout: 10000 });
    await expect(emptyState).toContainText(/no sessions today\. you have \d+ open case/i);

    // Verify "Schedule a session" button exists
    const scheduleBtn = page.getByTestId("schedule-session-empty-button");
    await expect(scheduleBtn).toBeVisible();
    await expect(scheduleBtn).toHaveAttribute("href", "/therapist/cases");

    await context.close();
  });
});
