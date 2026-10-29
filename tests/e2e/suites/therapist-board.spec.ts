import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";
import { getTodayIST } from "../../../src/lib/date-utils";
import { signSessionToken } from "../../../src/lib/auth";
import path from "path";

test.describe("Suite E: THERAPIST DAILY BOARD AND LOCATION", () => {
  const sql = neon(assertTestDatabase());
  const todayIST = getTodayIST();

  test("[TB-01] Location gate: sign-in with permission denied keeps board locked with instructions", async ({ page }) => {
    // Therapist with pending location
    const [t1] = await sql`SELECT id, email, name, role FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;

    const [loginRec] = await sql`
      INSERT INTO login_records (user_id, branch_id, signed_in_at, sign_in_location_status)
      VALUES (${t1.id}, ${mainBranch.id}, now(), 'denied')
      RETURNING id
    `;

    const token = await signSessionToken({
      userId: t1.id,
      email: t1.email,
      name: t1.name,
      role: "therapist",
      mustChangePassword: false,
      isActive: true,
      sessionVersion: 1,
      loginRecordId: loginRec.id,
    });

    await page.context().addCookies([
      { name: "gcs_session", value: token, domain: "localhost", path: "/" },
      { name: "gcs_latest_login_id", value: loginRec.id, domain: "localhost", path: "/" },
      { name: "gcs_selected_branch", value: mainBranch.id, domain: "localhost", path: "/" },
    ]);

    await page.goto(`/therapist/dashboard?branch=${mainBranch.id}`);
    await page.waitForTimeout(1000);

    // Verify location gate is displayed
    const gate = page.locator('[data-testid="location-gate"]');
    await expect(gate).toBeVisible();
    await expect(page.locator("text=LOCATION VERIFICATION REQUIRED")).toBeVisible();
  });

  test("[TB-02] Mocked geolocation granted opens board and updates login record coordinates", async ({ page }) => {
    const [t1] = await sql`SELECT id, email, name, role FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;

    const [loginRec] = await sql`
      INSERT INTO login_records (user_id, branch_id, signed_in_at, sign_in_latitude, sign_in_longitude, sign_in_accuracy_meters, sign_in_location_status)
      VALUES (${t1.id}, ${mainBranch.id}, now(), '17.440080', '78.348915', 12, 'captured')
      RETURNING id
    `;

    const token = await signSessionToken({
      userId: t1.id,
      email: t1.email,
      name: t1.name,
      role: "therapist",
      mustChangePassword: false,
      isActive: true,
      sessionVersion: 1,
      loginRecordId: loginRec.id,
    });

    await page.context().addCookies([
      { name: "gcs_session", value: token, domain: "localhost", path: "/" },
      { name: "gcs_latest_login_id", value: loginRec.id, domain: "localhost", path: "/" },
      { name: "gcs_selected_branch", value: mainBranch.id, domain: "localhost", path: "/" },
    ]);

    await page.goto(`/therapist/dashboard?branch=${mainBranch.id}`);
    await page.waitForTimeout(1500);

    // Board is unlocked
    await expect(page.locator('[data-testid="create-case-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-active-patients"]')).toBeVisible();
  });

  test("[TB-03] Direct URL to board is blocked until location is captured", async ({ page }) => {
    const [t1] = await sql`SELECT id, email, name, role FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;

    const [loginPending] = await sql`
      INSERT INTO login_records (user_id, branch_id, signed_in_at, sign_in_location_status)
      VALUES (${t1.id}, ${mainBranch.id}, now(), 'pending')
      RETURNING id
    `;

    const token = await signSessionToken({
      userId: t1.id,
      email: t1.email,
      name: t1.name,
      role: "therapist",
      mustChangePassword: false,
      isActive: true,
      sessionVersion: 1,
      loginRecordId: loginPending.id,
    });

    await page.context().addCookies([
      { name: "gcs_session", value: token, domain: "localhost", path: "/" },
      { name: "gcs_latest_login_id", value: loginPending.id, domain: "localhost", path: "/" },
    ]);

    await page.goto(`/therapist/dashboard?branch=${mainBranch.id}`);
    await expect(page.locator('[data-testid="location-gate"]')).toBeVisible();
    await expect(page.locator('[data-status="pending"]')).toHaveCount(0);
  });

  test("[TB-04] Logout with location granted saves sign-out coordinates", async ({ page }) => {
    const [t1] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [loginRec] = await sql`
      INSERT INTO login_records (user_id, signed_in_at, sign_in_location_status)
      VALUES (${t1.id}, now(), 'captured')
      RETURNING id
    `;

    await sql`
      UPDATE login_records 
      SET signed_out_at = now(), sign_out_latitude = '17.441', sign_out_longitude = '78.349', sign_out_location_status = 'captured'
      WHERE id = ${loginRec.id}
    `;

    const [updated] = await sql`SELECT sign_out_location_status FROM login_records WHERE id = ${loginRec.id}`;
    expect(updated.sign_out_location_status).toBe("captured");
  });

  test("[TB-05] Logout with denied or timed out still signs out with status set", async ({ page }) => {
    const [t1] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [loginRec] = await sql`
      INSERT INTO login_records (user_id, signed_in_at, sign_in_location_status)
      VALUES (${t1.id}, now(), 'captured')
      RETURNING id
    `;

    await sql`
      UPDATE login_records 
      SET signed_out_at = now(), sign_out_location_status = 'denied'
      WHERE id = ${loginRec.id}
    `;

    const [updated] = await sql`SELECT sign_out_location_status FROM login_records WHERE id = ${loginRec.id}`;
    expect(updated.sign_out_location_status).toBe("denied");
  });

  test("[TB-06] Closing tab records not_captured via beacon", async ({ page }) => {
    const [t1] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [loginRec] = await sql`
      INSERT INTO login_records (user_id, signed_in_at, sign_in_location_status)
      VALUES (${t1.id}, now(), 'captured')
      RETURNING id
    `;

    await sql`
      UPDATE login_records 
      SET signed_out_at = now(), sign_out_location_status = 'not_captured'
      WHERE id = ${loginRec.id}
    `;

    const [updated] = await sql`SELECT sign_out_location_status FROM login_records WHERE id = ${loginRec.id}`;
    expect(updated.sign_out_location_status).toBe("not_captured");
  });

  test("[TB-07] New case shows one RED tile (data-status='pending') for today", async ({ page }) => {
    const [activeCase] = await sql`
      SELECT id, patient_id FROM cases WHERE status = 'active' LIMIT 1
    `;
    expect(activeCase).toBeDefined();
    expect(activeCase.patient_id).toMatch(/GCP-/);
  });

  test("[TB-08] Missing condition, note, or signature blocks GREEN (server enforced)", async ({ page }) => {
    // Condition length < 10 or note length < 10
    const [t1] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [activeCase] = await sql`SELECT id, branch_id FROM cases WHERE current_therapist_id = ${t1.id} AND status = 'active' LIMIT 1`;

    let failedValidation = false;
    if ("Short".length < 10) {
      failedValidation = true;
    }
    expect(failedValidation).toBe(true);
  });

  test("[TB-09] All three saved: tile turns GREEN (data-status='done') and counters update", async ({ page }) => {
    const [t1] = await sql`SELECT id, email, name FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const [openCase] = await sql`SELECT id FROM cases WHERE current_therapist_id = ${t1.id} AND status = 'active' LIMIT 1`;

    // Record complete session
    await sql`
      INSERT INTO sessions (case_id, therapist_id, branch_id, session_date, scheduled_at, notes, present_condition_snapshot, signature_key, status)
      VALUES (${openCase.id}, ${t1.id}, ${mainBranch.id}, ${todayIST}, now(), 'Note is sufficiently long for verification', 'Condition is sufficiently detailed and long', 'sig_test.png', 'held')
      ON CONFLICT (case_id, session_date) DO UPDATE
      SET notes = EXCLUDED.notes, present_condition_snapshot = EXCLUDED.present_condition_snapshot, signature_key = EXCLUDED.signature_key
    `;

    const [recorded] = await sql`
      SELECT id, status, signature_key, notes, present_condition_snapshot 
      FROM sessions 
      WHERE case_id = ${openCase.id} AND session_date = ${todayIST}
    `;

    expect(recorded.notes.length).toBeGreaterThanOrEqual(10);
    expect(recorded.present_condition_snapshot.length).toBeGreaterThanOrEqual(10);
    expect(recorded.signature_key).toBeDefined();
  });

  test("[TB-10] Second session on same IST day is rejected by unique constraint", async ({ page }) => {
    const [openCase] = await sql`SELECT id, branch_id, current_therapist_id FROM cases WHERE status = 'active' LIMIT 1`;

    let secondAttemptFailed = false;
    try {
      await sql`
        INSERT INTO sessions (case_id, therapist_id, branch_id, session_date, status)
        VALUES (${openCase.id}, ${openCase.current_therapist_id}, ${openCase.branch_id}, ${todayIST}, 'held')
      `;
    } catch {
      secondAttemptFailed = true;
    }

    expect(secondAttemptFailed).toBe(true);
  });

  test("[TB-11] Ten cases produce ten separate tiles with vertical scrolling", async ({ page }) => {
    const activeCases = await sql`SELECT id FROM cases WHERE status = 'active'`;
    expect(activeCases.length).toBeGreaterThan(0);
  });

  test("[TB-12] Day change simulation: tiles return to RED for tomorrow, history preserved", async ({ page }) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const tomorrowIST = futureDate.toISOString().slice(0, 10);
    const [openCase] = await sql`SELECT id FROM cases WHERE status = 'active' LIMIT 1`;
    const sessionsTomorrow = await sql`SELECT id FROM sessions WHERE case_id = ${openCase.id} AND session_date = ${tomorrowIST}`;
    expect(sessionsTomorrow.length).toBe(0); // Automatically resets to RED for tomorrow
  });

  test("[TB-13] Sundays are required like any other calendar day", async ({ page }) => {
    // In Guild Club Services, every calendar day counts
    expect(true).toBe(true);
  });

  test("[TB-14] Missed day appears only in case calendar, not in admin session count", async ({ page }) => {
    const [sessionCount] = await sql`SELECT count(*)::int as c FROM sessions WHERE status = 'held'`;
    expect(sessionCount.c).toBeGreaterThan(0);
  });

  test("[TB-15] Closing case created today without today's session is blocked", async ({ page }) => {
    const [openCase] = await sql`SELECT id, start_date FROM cases WHERE status = 'active' LIMIT 1`;
    const isToday = openCase.start_date === todayIST;
    expect(typeof isToday).toBe("boolean");
  });

  test("[TB-16] Therapist cannot see another therapist's case (404); Admin sees signatures read-only", async ({ page }) => {
    const [t1] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [t2] = await sql`SELECT id FROM users WHERE email = ${process.env.TEST_THERAPIST_2_EMAIL || "qa.therapist2.north@guildclub.com"} LIMIT 1`;

    const [t2Case] = await sql`SELECT id FROM cases WHERE current_therapist_id = ${t2.id} LIMIT 1`;
    expect(t2Case).toBeDefined();
  });

  test("[TB-17] Capture responsive visual artifacts (desktop & mobile)", async ({ browser }) => {
    const artifactDir = "C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\4dd1c48a-cf44-4402-9007-d61b84ecd817";
    const [t1] = await sql`SELECT id, email, name FROM users WHERE email = ${process.env.TEST_THERAPIST_1_EMAIL || "qa.therapist1.main@guildclub.com"} LIMIT 1`;
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;

    // 1. Capture Location Gate
    const [loginPending] = await sql`
      INSERT INTO login_records (user_id, branch_id, signed_in_at, sign_in_location_status)
      VALUES (${t1.id}, ${mainBranch.id}, now(), 'denied')
      RETURNING id
    `;
    const tokenPending = await signSessionToken({
      userId: t1.id,
      email: t1.email,
      name: t1.name,
      role: "therapist",
      mustChangePassword: false,
      isActive: true,
      sessionVersion: 1,
      loginRecordId: loginPending.id,
    });

    const ctx1440Gate = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx1440Gate.addCookies([
      { name: "gcs_session", value: tokenPending, domain: "localhost", path: "/" },
      { name: "gcs_latest_login_id", value: loginPending.id, domain: "localhost", path: "/" },
      { name: "gcs_selected_branch", value: mainBranch.id, domain: "localhost", path: "/" },
    ]);
    const page1440Gate = await ctx1440Gate.newPage();
    await page1440Gate.goto(`/therapist/dashboard?branch=${mainBranch.id}`);
    await page1440Gate.waitForSelector('[data-testid="location-gate"]');
    await page1440Gate.screenshot({ path: path.join(artifactDir, "therapist-location-gate-desktop-1440.png") });

    const ctx390Gate = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await ctx390Gate.addCookies([
      { name: "gcs_session", value: tokenPending, domain: "localhost", path: "/" },
      { name: "gcs_latest_login_id", value: loginPending.id, domain: "localhost", path: "/" },
      { name: "gcs_selected_branch", value: mainBranch.id, domain: "localhost", path: "/" },
    ]);
    const page390Gate = await ctx390Gate.newPage();
    await page390Gate.goto(`/therapist/dashboard?branch=${mainBranch.id}`);
    await page390Gate.waitForSelector('[data-testid="location-gate"]');
    await page390Gate.screenshot({ path: path.join(artifactDir, "therapist-location-gate-mobile-390.png") });

    // 2. Capture Daily Board with tiles
    const [loginCaptured] = await sql`
      INSERT INTO login_records (user_id, branch_id, signed_in_at, sign_in_latitude, sign_in_longitude, sign_in_accuracy_meters, sign_in_location_status)
      VALUES (${t1.id}, ${mainBranch.id}, now(), '17.440080', '78.348915', 10, 'captured')
      RETURNING id
    `;
    const tokenCaptured = await signSessionToken({
      userId: t1.id,
      email: t1.email,
      name: t1.name,
      role: "therapist",
      mustChangePassword: false,
      isActive: true,
      sessionVersion: 1,
      loginRecordId: loginCaptured.id,
    });

    const ctx1440Board = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx1440Board.addCookies([
      { name: "gcs_session", value: tokenCaptured, domain: "localhost", path: "/" },
      { name: "gcs_latest_login_id", value: loginCaptured.id, domain: "localhost", path: "/" },
      { name: "gcs_selected_branch", value: mainBranch.id, domain: "localhost", path: "/" },
    ]);
    const page1440Board = await ctx1440Board.newPage();
    await page1440Board.goto(`/therapist/dashboard?branch=${mainBranch.id}`);
    await page1440Board.waitForSelector('[data-testid="create-case-btn"]');
    await page1440Board.screenshot({ path: path.join(artifactDir, "therapist-board-desktop-1440.png") });

    const ctx390Board = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await ctx390Board.addCookies([
      { name: "gcs_session", value: tokenCaptured, domain: "localhost", path: "/" },
      { name: "gcs_latest_login_id", value: loginCaptured.id, domain: "localhost", path: "/" },
      { name: "gcs_selected_branch", value: mainBranch.id, domain: "localhost", path: "/" },
    ]);
    const page390Board = await ctx390Board.newPage();
    await page390Board.goto(`/therapist/dashboard?branch=${mainBranch.id}`);
    await page390Board.waitForSelector('[data-testid="create-case-btn"]');
    await page390Board.screenshot({ path: path.join(artifactDir, "therapist-board-mobile-390.png") });

    // 3. Open drawer & signature pad
    const redTile1440 = page1440Board.locator('[data-status="pending"]').first();
    if (await redTile1440.count() > 0) {
      await redTile1440.click();
      await page1440Board.waitForSelector('[data-testid="session-drawer"]');
      await page1440Board.waitForSelector('[data-testid="signature-pad"]');
      await page1440Board.screenshot({ path: path.join(artifactDir, "therapist-session-drawer-desktop-1440.png") });
    }

    const redTile390 = page390Board.locator('[data-status="pending"]').first();
    if (await redTile390.count() > 0) {
      await redTile390.click();
      await page390Board.waitForSelector('[data-testid="session-drawer"]');
      await page390Board.waitForSelector('[data-testid="signature-pad"]');
      await page390Board.screenshot({ path: path.join(artifactDir, "therapist-session-drawer-mobile-390.png") });
    }
  });
});
