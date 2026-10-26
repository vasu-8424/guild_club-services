/**
 * Stage 2 – Full End-to-End User Journey Test (E2E-01)
 * Unbroken lifecycle flow across all 3 roles:
 * Super Admin creates Admin -> Admin logs in & changes temp password -> Admin registers Therapist ->
 * Admin creates Case -> Admin assigns Case -> Therapist logs in & changes temp password ->
 * Therapist accepts Case -> Advances to in_progress -> Adds Clinical Note -> Schedules Session ->
 * Marks Session Held -> Closes Case -> Verifies audit event & email notification.
 */
import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../helpers/seed-test-data";
import {
  getLatestEmail,
  getTempPasswordFromEmail,
  getEvents,
  getCaseByNumber,
  setDateTimeInput,
} from "../helpers/stage2-helpers";

const SA = {
  email: process.env.TEST_SUPER_ADMIN_EMAIL ?? "test.superadmin@guildclub.com",
  password: process.env.TEST_SUPER_ADMIN_PASSWORD ?? "TestSuperAdmin@123",
};

const timestamp = Date.now();
const journeyAdmin = {
  name: `Journey Admin ${timestamp}`,
  email: `jadmin.${timestamp}@guildclubtest.com`,
  phone: "+91 9811111111",
  permanentPassword: "JAdminPerm@12345",
};

const journeyTherapist = {
  name: `Dr. Journey Therapist ${timestamp}`,
  email: `jtherapist.${timestamp}@guildclubtest.com`,
  phone: "+91 9822222222",
  specialization: "Clinical Neuropsychology",
  experienceYears: "8",
  maxOpenCases: "15",
  permanentPassword: "JTherapistPerm@12345",
};

const journeyCase = {
  clientName: `Journey Client ${timestamp}`,
  clientEmail: `jclient.${timestamp}@example.com`,
  clientPhone: "+91 9833333333",
  clientAge: "32",
  presentingIssues: "General anxiety disorder with occupational burnout.",
  priority: "high" as const,
};

test.describe.serial("E2E: Complete Multi-Role Lifecycle Journey", () => {
  let journeyTherapistId = "";
  let journeyCaseId = "";
  let journeyCaseNumber = "";

  test("E2E-01: Complete unbroken lifecycle from Super Admin setup to Case Discharge", async ({ page }) => {
    test.setTimeout(180000);
    // -------------------------------------------------------------------------
    // Step 1: Super Admin creates an Admin
    // -------------------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SA.email);
    await page.fill('[data-testid="login-password-input"]', SA.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });

    await page.goto("/super-admin/admins/new");
    await page.getByTestId("admin-name-input").fill(journeyAdmin.name);
    await page.getByTestId("admin-email-input").fill(journeyAdmin.email);
    await page.getByTestId("admin-phone-input").fill(journeyAdmin.phone);
    await page.getByTestId("admin-password-input").fill(journeyAdmin.permanentPassword);
    await page.getByTestId("admin-confirm-password-input").fill(journeyAdmin.permanentPassword);
    await page.locator('[data-testid="admin-submit-button"]').click();

    // Confirmation card with copy credentials and done button
    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("done-button").click();
    await expect(page).toHaveURL(/\/super-admin\/admins/, { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 2: New Admin logs in directly to /admin/dashboard
    // -------------------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', journeyAdmin.email);
    await page.fill('[data-testid="login-password-input"]', journeyAdmin.permanentPassword);
    await page.click('[data-testid="login-submit-button"]');

    // Redirected straight to admin dashboard with no password change prompt
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 3: Admin registers a new Therapist
    // -------------------------------------------------------------------------
    await page.goto("/admin/therapists/new");
    await page.getByTestId("therapist-name-input").fill(journeyTherapist.name);
    await page.getByTestId("therapist-email-input").fill(journeyTherapist.email);
    await page.getByTestId("therapist-phone-input").fill(journeyTherapist.phone);
    await page.getByTestId("therapist-specialization-input").fill(journeyTherapist.specialization);
    await page.getByTestId("therapist-experience-input").fill(journeyTherapist.experienceYears);
    await page.getByTestId("therapist-max-cases-input").fill(journeyTherapist.maxOpenCases);
    await page.getByTestId("therapist-password-input").fill(journeyTherapist.permanentPassword);
    await page.getByTestId("therapist-confirm-password-input").fill(journeyTherapist.permanentPassword);
    await page.locator('[data-testid="therapist-submit-button"]').click();

    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("done-button").click();
    await expect(page).toHaveURL(/\/admin\/therapists/, { timeout: 15000 });

    // Fetch therapist ID from DB
    const sql = neon(assertTestDatabase());
    const thRows = await sql.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [journeyTherapist.email]);
    expect(thRows.length).toBe(1);
    journeyTherapistId = thRows[0]["id"] as string;

    // -------------------------------------------------------------------------
    // Step 4: Admin creates a Case
    // -------------------------------------------------------------------------
    await page.goto("/admin/cases/new");
    await page.getByTestId("case-client-name-input").fill(journeyCase.clientName);
    await page.getByTestId("case-client-email-input").fill(journeyCase.clientEmail);
    await page.getByTestId("case-client-phone-input").fill(journeyCase.clientPhone);
    await page.getByTestId("case-client-age-input").fill(journeyCase.clientAge);
    await page.getByTestId("case-presenting-issues-input").fill(journeyCase.presentingIssues);
    await page.getByTestId("case-priority-select").selectOption(journeyCase.priority);
    await page.locator('[data-testid="case-submit-button"], [data-testid="create-case-submit"]').first().click();

    await expect(page.getByTestId("case-created-number")).toBeVisible({ timeout: 15000 });
    const cardText = await page.getByTestId("case-created-number").textContent();
    const currentYear = new Date().getFullYear();
    const match = cardText?.match(new RegExp(`GCS-${currentYear}-\\d{4}`));
    expect(match).not.toBeNull();
    journeyCaseNumber = match![0];

    const caseRec = await getCaseByNumber(journeyCaseNumber);
    expect(caseRec).not.toBeNull();
    journeyCaseId = caseRec!["id"] as string;

    await page.getByTestId("case-done-button").click();
    await expect(page).toHaveURL(/\/admin\/cases/, { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 5: Admin assigns Case to Therapist
    // -------------------------------------------------------------------------
    await page.goto(`/admin/cases/${journeyCaseId}`);
    await page.getByTestId("assign-therapist-select").selectOption(journeyTherapistId);
    await page.getByTestId("assign-notes-input").fill("Priority assignment: intake session needed this week.");
    await page.locator('[data-testid="assign-submit-button"], [data-testid="assign-case-submit"]').first().click();

    await expect(page.getByTestId("assign-success-message")).toBeVisible({ timeout: 15000 });

    // Verify assignment email is NOT queued (removed per user directive)
    const assignEmail = await getLatestEmail(journeyTherapist.email, "case_assigned");
    expect(assignEmail, "case_assigned email should NOT be queued to therapist").toBeNull();

    // -------------------------------------------------------------------------
    // Step 6: Therapist logs in directly to /therapist/dashboard
    // -------------------------------------------------------------------------
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', journeyTherapist.email);
    await page.fill('[data-testid="login-password-input"]', journeyTherapist.permanentPassword);
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 7: Therapist accepts assigned Case
    // -------------------------------------------------------------------------
    await expect(page.locator("body")).toContainText(journeyCaseNumber, { timeout: 10000 });
    await page.getByTestId("invitation-accept-button").first().click();
    await expect(page.getByTestId("invitation-accept-button")).toHaveCount(0, { timeout: 15000 });

    // Verify status accepted in DB
    const acceptedStatus = await sql.query("SELECT status FROM cases WHERE id = $1", [journeyCaseId]);
    expect(acceptedStatus[0]["status"]).toBe("accepted");

    // -------------------------------------------------------------------------
    // Step 8: Therapist advances Case to in_progress
    // -------------------------------------------------------------------------
    await page.goto(`/therapist/cases/${journeyCaseId}`);
    await page.getByTestId("case-status-select").selectOption("in_progress");
    await page.getByTestId("case-status-notes-input").fill("Assessment completed; therapy active.");
    await page.getByTestId("case-status-submit-button").click();

    await expect(page.getByTestId("case-status-success-message")).toContainText("in_progress", { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 9: Therapist adds a Clinical Note
    // -------------------------------------------------------------------------
    const noteText = "Comprehensive clinical intake note: Client shows positive engagement with mindfulness exercises.";
    await page.getByTestId("note-input").fill(noteText);
    await page.getByTestId("note-submit-button").click();

    await expect(page.getByTestId("note-success-message")).toBeVisible({ timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 10: Therapist schedules a Session
    // -------------------------------------------------------------------------
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 2);
    const dateStr = sessionDate.toISOString().slice(0, 16);

    await setDateTimeInput(page.getByTestId("session-date-input"), dateStr);
    await page.getByTestId("session-duration-input").fill("60");
    await page.getByTestId("session-notes-input").fill("Session 1: Cognitive restructuring");
    await page.getByTestId("session-submit-button").click();

    // -------------------------------------------------------------------------
    // Step 11: Therapist marks Session as Held
    // -------------------------------------------------------------------------
    const heldBtn = page.getByTestId("session-held-button").first();
    await expect(heldBtn).toBeVisible({ timeout: 10000 });
    await heldBtn.click();
    await expect(page.locator("body")).toContainText("held", { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 12: Therapist closes Case with successful outcome
    // -------------------------------------------------------------------------
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("case-outcome-select").selectOption("successful");
    await page.getByTestId("case-closing-notes-input").fill("Discharge report: Client achieved all behavioral targets.");
    await page.getByTestId("case-close-submit-button").click();

    await expect(page.getByTestId("case-status-success-message")).toContainText(/closed/i, { timeout: 15000 });

    // -------------------------------------------------------------------------
    // Step 13: Final assertions — verify DB state & email notifications
    // -------------------------------------------------------------------------
    const finalCase = await sql.query("SELECT status, outcome, closed_at FROM cases WHERE id = $1", [journeyCaseId]);
    expect(finalCase[0]["status"]).toBe("completed");
    expect(finalCase[0]["outcome"]).toBe("successful");
    expect(finalCase[0]["closed_at"]).not.toBeNull();

    const caseClosedEvents = await getEvents(journeyCaseId, "case_closed");
    expect(caseClosedEvents.length, "case_closed audit event must exist").toBeGreaterThan(0);

    const closeEmail = await getLatestEmail(journeyAdmin.email, "case_closed");
    expect(closeEmail, "case_closed notification email must be queued for admin").not.toBeNull();
  });
});
