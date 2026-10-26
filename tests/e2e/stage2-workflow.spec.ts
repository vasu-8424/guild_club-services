/**
 * Stage 2 – Therapist Workflow Tests (THW-01 to THW-13)
 * Therapist case workflow: accept invitation, add clinical notes, schedule sessions,
 * record session attendance, update case lifecycle status, and close case with outcome.
 */
import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";
import { getLatestEmail, getEvents, setDateTimeInput } from "../helpers/stage2-helpers";

const THERAPIST = {
  email: process.env.TEST_THERAPIST_EMAIL ?? "test.therapist@guildclub.com",
  password: process.env.TEST_THERAPIST_PASSWORD ?? "TestTherapist@123",
};

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? "test.admin@guildclub.com",
  password: process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin@123",
};

let workflowCaseId = "";
let workflowCaseNumber = "";

async function loginAsTherapist(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', THERAPIST.email);
  await page.fill('[data-testid="login-password-input"]', THERAPIST.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });
}

test.describe.serial("THW: Therapist Case Workflow", () => {
  // Before running workflow tests, create and assign a dedicated case via API/DB
  test.beforeAll(async () => {
    const sql = neon(assertTestDatabase());

    // 1. Get therapist and admin user IDs
    const thRows = await sql.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [THERAPIST.email]
    );
    const therapistId = thRows[0]["id"] as string;

    const adminRows = await sql.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [ADMIN.email]
    );
    const adminId = adminRows[0]["id"] as string;

    // 2. Create client
    const clientRows = await sql.query(
      `INSERT INTO clients (full_name, email, phone, age, gender)
       VALUES ('Workflow Client', 'workflow.client@test.com', '+91 9999900001', 30, 'Non-binary')
       RETURNING id`
    );
    const clientId = clientRows[0]["id"] as string;

    // 3. Generate case number
    const currentYear = new Date().getFullYear();
    const prefix = `GCS-${currentYear}-`;
    const lastCaseRows = await sql.query(
      "SELECT case_number FROM cases WHERE case_number LIKE $1 ORDER BY case_number DESC LIMIT 1",
      [`${prefix}%`]
    );
    let nextSeq = 9001;
    if (lastCaseRows.length > 0) {
      const parts = (lastCaseRows[0]["case_number"] as string).split("-");
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq)) nextSeq = seq + 1;
    }
    workflowCaseNumber = `${prefix}${String(nextSeq).padStart(4, "0")}`;

    // 4. Create case in 'assigned' status
    const caseRows = await sql.query(
      `INSERT INTO cases (case_number, client_id, category, priority, status, description, current_therapist_id, created_by)
       VALUES ($1, $2, 'Individual Therapy', 'high', 'assigned', 'Dedicated test case for full therapist workflow testing.', $3, $4)
       RETURNING id`,
      [workflowCaseNumber, clientId, therapistId, adminId]
    );
    workflowCaseId = caseRows[0]["id"] as string;

    // 5. Record case_assigned event
    await sql.query(
      `INSERT INTO case_events (case_id, event_type, actor_id, actor_role, from_status, to_status, metadata)
       VALUES ($1, 'case_assigned', $2, 'admin', 'new', 'assigned', $3::jsonb)`,
      [
        workflowCaseId,
        adminId,
        JSON.stringify({ therapistId, notes: "Automated test assignment" }),
      ]
    );
  });

  test.beforeEach(async () => {
    test.setTimeout(60000);
  });

  test("THW-01: Therapist sees pending assigned case invitation on dashboard", async ({ page }) => {
    await loginAsTherapist(page);
    await expect(page.locator("body")).toContainText(workflowCaseNumber, { timeout: 10000 });
    const invitationRow = page.getByTestId(`invitation-row-${workflowCaseNumber}`);
    await expect(invitationRow.getByTestId("invitation-accept-button")).toBeVisible({ timeout: 10000 });
  });

  test("THW-02: Therapist accepts case invitation; case status changes to accepted", async ({ page }) => {
    await loginAsTherapist(page);

    // Click accept on the specific workflow case
    const invitationRow = page.getByTestId(`invitation-row-${workflowCaseNumber}`);
    await invitationRow.getByTestId("invitation-accept-button").click();

    // Auto-wait for this specific case's invitation to disappear from pending
    await expect(page.getByTestId(`invitation-row-${workflowCaseNumber}`)).toHaveCount(0, { timeout: 15000 });

    // Verify status in DB
    const sql = neon(assertTestDatabase());
    const rows = await sql.query(
      "SELECT status FROM cases WHERE id = $1",
      [workflowCaseId]
    );
    expect(rows[0]["status"]).toBe("accepted");

    // Verify case_accepted event in DB
    const events = await getEvents(workflowCaseId, "case_accepted");
    expect(events.length, "case_accepted event should be recorded").toBeGreaterThan(0);
  });

  test("THW-03: Accepted case appears in active caseload and navigates to detail", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto("/therapist/cases");
    await expect(page.locator("body")).toContainText(workflowCaseNumber, { timeout: 10000 });

    // Navigate to therapist case detail page
    await page.goto(`/therapist/cases/${workflowCaseId}`);
    await expect(page).toHaveURL(`/therapist/cases/${workflowCaseId}`);
    await expect(page.locator("body")).toContainText(workflowCaseNumber, { timeout: 10000 });
  });

  test("THW-04: Therapist adds a clinical note; verify note_added event", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);

    const noteContent = "Client attended intake session, presented with moderate anxiety. Coping strategies discussed.";
    await page.getByTestId("note-input").fill(noteContent);
    await page.getByTestId("note-submit-button").click();

    await expect(page.getByTestId("note-success-message")).toBeVisible({ timeout: 15000 });

    // Verify note in DB
    const sql = neon(assertTestDatabase());
    const notes = await sql.query(
      "SELECT note FROM case_notes WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
      [workflowCaseId]
    );
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]["note"]).toContain("Client attended intake");

    // Verify note_added event in DB
    const events = await getEvents(workflowCaseId, "note_added");
    expect(events.length, "note_added event must be recorded").toBeGreaterThan(0);
  });

  test("THW-05: Therapist schedules a session; verify session_scheduled event", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);
    await page.waitForLoadState("networkidle");

    // Set date 3 days into future
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const dateStr = futureDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"

    await page.getByTestId("session-date-input").click();
    await setDateTimeInput(page.getByTestId("session-date-input"), dateStr);
    await page.getByTestId("session-duration-input").fill("50");
    await page.getByTestId("session-notes-input").fill("Initial CBT assessment session");
    await page.getByTestId("session-submit-button").click();

    await expect(page.getByTestId("session-success-message")).toBeVisible({ timeout: 15000 });

    // Verify session in DB
    const sql = neon(assertTestDatabase());
    const sessions = await sql.query(
      "SELECT id, status FROM sessions WHERE case_id = $1 ORDER BY scheduled_at DESC LIMIT 1",
      [workflowCaseId]
    );
    expect(sessions.length, "Session should be created in DB").toBeGreaterThan(0);
    expect(sessions[0]["status"]).toBe("scheduled");

    // Verify session_scheduled event in DB
    const events = await getEvents(workflowCaseId, "session_scheduled");
    expect(events.length, "session_scheduled event must be recorded").toBeGreaterThan(0);
  });

  test("THW-06: Therapist marks session as held; verify session_held event", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);

    const heldBtn = page.getByTestId("session-held-button").first();
    await expect(heldBtn).toBeVisible({ timeout: 10000 });
    await heldBtn.click();

    await expect(page.locator("body")).toContainText("held", { timeout: 15000 });

    // Verify session status in DB
    const sql = neon(assertTestDatabase());
    const sessions = await sql.query(
      "SELECT status FROM sessions WHERE case_id = $1 ORDER BY scheduled_at DESC LIMIT 1",
      [workflowCaseId]
    );
    expect(sessions[0]["status"]).toBe("held");

    // Verify session_held event in DB
    const events = await getEvents(workflowCaseId, "session_held");
    expect(events.length, "session_held event must be recorded").toBeGreaterThan(0);
  });

  test("THW-07: Therapist schedules another session and marks it missed", async ({ page }) => {
    // Insert another session directly via SQL to test marking missed
    const sql = neon(assertTestDatabase());
    const thRows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [THERAPIST.email]);
    const therapistId = thRows[0]["id"] as string;

    const yesterday = new Date(Date.now() - 86400000).toISOString();
    await sql.query(
      `INSERT INTO sessions (case_id, therapist_id, scheduled_at, status, notes)
       VALUES ($1, $2, $3, 'scheduled', 'Follow-up check-in')`,
      [workflowCaseId, therapistId, yesterday]
    );

    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);

    const missedBtn = page.getByTestId("session-missed-button").first();
    await expect(missedBtn).toBeVisible({ timeout: 10000 });
    await missedBtn.click();

    await expect(page.locator("body")).toContainText("missed", { timeout: 15000 });

    // Verify session_missed event in DB
    const events = await getEvents(workflowCaseId, "session_missed");
    expect(events.length, "session_missed event must be recorded").toBeGreaterThan(0);
  });

  test("THW-08: Therapist updates case status from accepted to in_progress", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);

    await page.getByTestId("case-status-select").selectOption("in_progress");
    await page.getByTestId("case-status-notes-input").fill("Formal treatment plan established.");
    await page.getByTestId("case-status-submit-button").click();

    await expect(page.getByTestId("case-status-success-message")).toContainText("in_progress", { timeout: 15000 });

    // Verify DB
    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT status FROM cases WHERE id = $1", [workflowCaseId]);
    expect(rows[0]["status"]).toBe("in_progress");

    // Verify status_changed event
    const events = await getEvents(workflowCaseId, "status_changed");
    expect(events.length, "status_changed event must be recorded").toBeGreaterThan(0);
  });

  test("THW-09: Therapist puts case on hold (in_progress -> on_hold)", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);

    await page.getByTestId("case-status-select").selectOption("on_hold");
    await page.getByTestId("case-status-notes-input").fill("Client on temporary travel for 3 weeks.");
    await page.getByTestId("case-status-submit-button").click();

    await expect(page.getByTestId("case-status-success-message")).toContainText("on_hold", { timeout: 15000 });

    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT status FROM cases WHERE id = $1", [workflowCaseId]);
    expect(rows[0]["status"]).toBe("on_hold");
  });

  test("THW-10: Therapist resumes case from hold (on_hold -> in_progress)", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);

    await page.getByTestId("case-status-select").selectOption("in_progress");
    await page.getByTestId("case-status-notes-input").fill("Client returned; resuming weekly cadence.");
    await page.getByTestId("case-status-submit-button").click();

    await expect(page.getByTestId("case-status-success-message")).toContainText("in_progress", { timeout: 15000 });

    const sql = neon(assertTestDatabase());
    const rows = await sql.query("SELECT status FROM cases WHERE id = $1", [workflowCaseId]);
    expect(rows[0]["status"]).toBe("in_progress");
  });

  test("THW-11: Therapist closes case with successful outcome; verify case_closed event", async ({ page }) => {
    await loginAsTherapist(page);
    await page.goto(`/therapist/cases/${workflowCaseId}`);

    // Register dialog handler for window.confirm
    page.on("dialog", (dialog) => dialog.accept());

    await page.getByTestId("case-outcome-select").selectOption("successful");
    await page.getByTestId("case-closing-notes-input").fill("All therapy objectives achieved. Full discharge.");
    await page.getByTestId("case-close-submit-button").click();

    await expect(page.getByTestId("case-status-success-message")).toContainText(/closed/i, { timeout: 15000 });

    // Verify DB
    const sql = neon(assertTestDatabase());
    const rows = await sql.query(
      "SELECT status, outcome, closed_at FROM cases WHERE id = $1",
      [workflowCaseId]
    );
    expect(rows[0]["status"]).toBe("completed");
    expect(rows[0]["outcome"]).toBe("successful");
    expect(rows[0]["closed_at"]).not.toBeNull();

    // Verify case_closed event in DB
    const events = await getEvents(workflowCaseId, "case_closed");
    expect(events.length, "case_closed event must be recorded").toBeGreaterThan(0);
  });

  test("THW-12: Closing case queues case_closed email to admin", async ({ page }) => {
    void page;
    const email = await getLatestEmail(ADMIN.email, "case_closed");
    expect(email, "case_closed email should be queued to admin").not.toBeNull();
  });

  test("THW-13: Therapist role calling /api/admin/therapists returns 403", async ({ page }) => {
    await loginAsTherapist(page);
    const res = await page.request.get("/api/admin/therapists");
    // Therapist cannot call admin-only endpoints
    expect(res.status()).toBe(403);
  });
});
