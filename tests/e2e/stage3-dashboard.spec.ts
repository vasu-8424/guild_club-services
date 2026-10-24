import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import path from "path";
import { assertTestDatabase } from "../helpers/stage2-helpers";
import { getTodayIST, getYesterdayIST, getDaysAgoIST } from "../../src/lib/date-utils";

const authDir = path.resolve(process.cwd(), "playwright/.auth");

test.describe("DSH: Date-Wise Dashboards, Analytics & Stage 3 Features", () => {
  let adminId = "";
  let therapistId = "";
  let testCaseId = "";
  let testCaseNumber = "";
  let dayXStr = "";
  let dayXPlus1Str = "";

  test.beforeAll(async () => {
    const sql = neon(assertTestDatabase());

    // 1. Get seeded user IDs
    const adminRows = await sql`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `;
    const therapistRows = await sql`
      SELECT id FROM users WHERE role = 'therapist' LIMIT 1
    `;
    adminId = adminRows[0].id;
    therapistId = therapistRows[0].id;

    // 2. Insert a dedicated client
    const clientRows = await sql`
      INSERT INTO clients (full_name, age, gender, phone, email)
      VALUES ('Stage 3 Test Client', 32, 'Female', '+91 9999988888', 'stage3.client@test.com')
      RETURNING id
    `;
    const clientId = clientRows[0].id;

    // 3. Create a dedicated case
    const currentYear = new Date().getFullYear();
    testCaseNumber = `GCS-${currentYear}-9991`;
    const caseRows = await sql`
      INSERT INTO cases (case_number, client_id, category, priority, description, status, created_by, current_therapist_id)
      VALUES (${testCaseNumber}, ${clientId}, 'Cognitive Behavioral Therapy (CBT)', 'high', 'Case for Stage 3 testing', 'in_progress', ${adminId}, ${therapistId})
      ON CONFLICT (case_number) DO UPDATE SET status = 'in_progress'
      RETURNING id
    `;
    testCaseId = caseRows[0].id;

    // 4. Set Day X as 5 days ago and Day X+1 as 4 days ago
    dayXStr = getDaysAgoIST(5);
    dayXPlus1Str = getDaysAgoIST(4);

    // 5. Insert events for Day X:
    // Event A: Afternoon event on Day X (14:30 IST) -> UTC is 09:00:00Z
    const afternoonIST = new Date(`${dayXStr}T09:00:00.000Z`);
    await sql`
      INSERT INTO case_events (event_type, actor_id, actor_role, case_id, metadata, occurred_at)
      VALUES ('session_held', ${therapistId}, 'therapist', ${testCaseId}, ${JSON.stringify({ notes: "Afternoon session Day X" })}, ${afternoonIST})
    `;

    // Event B: NEAR-MIDNIGHT EVENT 1 on Day X: 23:58:00 IST (UTC 18:28:00Z)
    const lateIST = new Date(`${dayXStr}T18:28:00.000Z`);
    await sql`
      INSERT INTO case_events (event_type, actor_id, actor_role, case_id, metadata, occurred_at)
      VALUES ('session_held', ${therapistId}, 'therapist', ${testCaseId}, ${JSON.stringify({ notes: "Near-midnight boundary test 23:58 IST" })}, ${lateIST})
    `;

    // Event C: NEAR-MIDNIGHT EVENT 2 on Day X+1: 00:03:00 IST (UTC 18:33:00Z on Day X calendar date)
    const earlyNextIST = new Date(`${dayXStr}T18:33:00.000Z`);
    await sql`
      INSERT INTO case_events (event_type, actor_id, actor_role, case_id, metadata, occurred_at)
      VALUES ('note_added', ${therapistId}, 'therapist', ${testCaseId}, ${JSON.stringify({ noteSnippet: "Near-midnight boundary test 00:03 IST next day" })}, ${earlyNextIST})
    `;

    // Event D: Status movement on Day X
    await sql`
      INSERT INTO case_events (event_type, actor_id, actor_role, case_id, from_status, to_status, metadata, occurred_at)
      VALUES ('status_changed', ${therapistId}, 'therapist', ${testCaseId}, 'accepted', 'in_progress', ${JSON.stringify({ notes: "Mid-afternoon transition" })}, ${afternoonIST})
    `;
  });

  test("DSH-01: Date Selector appears in top bar on all role dashboards defaulting to Today", async ({ browser }) => {
    const roles = ["super-admin", "admin", "therapist"] as const;

    for (const r of roles) {
      const context = await browser.newContext({
        storageState: path.join(authDir, `${r}.json`),
      });
      const page = await context.newPage();
      await page.goto(`/${r}/dashboard`);

      // Verify date selector trigger is visible in topbar
      const dateSelector = page.getByTestId("dashboard-date-selector");
      await expect(dateSelector).toBeVisible({ timeout: 10000 });
      await expect(dateSelector).toContainText(/today/i);

      await context.close();
    }
  });

  test("DSH-02: Selecting Yesterday updates the URL and re-renders dashboard", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();
    await page.goto("/super-admin/dashboard");

    // Open dropdown
    await page.getByTestId("dashboard-date-selector").click();
    await expect(page.getByTestId("date-selector-dropdown")).toBeVisible();

    // Click Yesterday preset
    await page.getByTestId("preset-yesterday-button").click();

    // Verify URL contains ?date=
    const yesterday = getYesterdayIST();
    await expect(page).toHaveURL(new RegExp(`date=${yesterday}`), { timeout: 10000 });

    // Verify trigger reflects Yesterday or date
    await expect(page.getByTestId("dashboard-date-selector")).toContainText(/yesterday|history/i);

    await context.close();
  });

  test("DSH-03: Selecting a past date displays 'Viewing history (read-only)' banner", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();

    // Navigate directly with bookmarkable URL for Day X
    await page.goto(`/super-admin/dashboard?date=${dayXStr}`);

    // Verify History read-only banner appears
    const banner = page.getByTestId("history-banner");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText(/viewing history \(read-only\)/i);

    await context.close();
  });

  test("DSH-04: Empty date displays 'No activity on this date' banner", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();

    // Choose an empty past date 100 days ago
    const emptyDate = getDaysAgoIST(100);
    await page.goto(`/super-admin/dashboard?date=${emptyDate}`);

    const noActivityBanner = page.getByTestId("no-activity-banner");
    await expect(noActivityBanner).toBeVisible({ timeout: 10000 });
    await expect(noActivityBanner).toContainText(/no activity on this date/i);

    await context.close();
  });

  test("DSH-05: Near-midnight IST events are accurately partitioned across day boundaries", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });

    // Query API for Day X summary
    const resDayX = await context.request.get(`/api/dashboard/summary?date=${dayXStr}`);
    expect(resDayX.status()).toBe(200);
    const jsonDayX = await resDayX.json();

    // Day X had 2 sessions held: one at 14:30 IST and one at 23:58:00 IST
    expect(jsonDayX.data.sessionsHeld, "Day X should contain both 14:30 and 23:58 IST sessions").toBe(2);

    // Day X should NOT contain the note_added event that occurred at 00:03 IST on Day X+1
    expect(jsonDayX.data.notesAdded, "Day X should NOT include next day 00:03 IST note").toBe(0);

    // Query API for Day X+1 summary
    const resDayXPlus1 = await context.request.get(`/api/dashboard/summary?date=${dayXPlus1Str}`);
    expect(resDayXPlus1.status()).toBe(200);
    const jsonDayXPlus1 = await resDayXPlus1.json();

    // Day X+1 must contain the note added at 00:03 IST
    expect(jsonDayXPlus1.data.notesAdded, "Day X+1 should contain the 00:03 IST note").toBeGreaterThanOrEqual(1);

    await context.close();
  });

  test("DSH-06: Clicking a KPI card opens the Drill-Down drawer with timestamped actions", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();
    await page.goto(`/super-admin/dashboard?date=${dayXStr}`);

    // Click Sessions Held KPI card
    const sessionsCard = page.getByTestId("kpi-card-sessions-held");
    await expect(sessionsCard).toBeVisible({ timeout: 10000 });
    await sessionsCard.click();

    // Verify Drill-down drawer opens
    const drawer = page.getByTestId("drilldown-drawer");
    await expect(drawer).toBeVisible({ timeout: 10000 });
    await expect(drawer).toContainText(/sessions held/i);

    // Verify timestamped items exist
    const items = drawer.getByTestId("drilldown-item");
    await expect(items.first()).toBeVisible({ timeout: 10000 });

    // Close drawer
    await page.getByTestId("drilldown-close-button").click();
    await expect(drawer).toBeHidden({ timeout: 5000 });

    await context.close();
  });

  test("DSH-07: Case Movements list displays status transitions and opens case drill-down", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();
    await page.goto(`/super-admin/dashboard?date=${dayXStr}`);

    // Verify case movements row is rendered
    const movementRow = page.getByTestId("movement-row").first();
    await expect(movementRow).toBeVisible({ timeout: 10000 });
    await expect(movementRow).toContainText(testCaseNumber);

    // Click movement row to open drilldown
    await movementRow.click();
    const drawer = page.getByTestId("drilldown-drawer");
    await expect(drawer).toBeVisible({ timeout: 10000 });
    await expect(drawer).toContainText(testCaseNumber);

    await context.close();
  });

  test("DSH-08: Role enforcement: Therapist calling /api/dashboard/people or /movements returns 403", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();

    // 1. Therapist calling people endpoint -> 403 Forbidden
    const peopleRes = await page.request.get("/api/dashboard/people");
    expect(peopleRes.status()).toBe(403);

    // 2. Therapist calling movements endpoint -> 403 Forbidden
    const movementsRes = await page.request.get("/api/dashboard/movements");
    expect(movementsRes.status()).toBe(403);

    await context.close();
  });

  test("DSH-09: Role enforcement: Therapist drilldown forces therapist's own ID", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "therapist.json"),
    });
    const page = await context.newPage();

    // Therapist attempts to pass another actorId in query
    const res = await page.request.get(`/api/dashboard/drilldown?actorId=${adminId}&date=${dayXStr}`);
    expect(res.status()).toBe(200);
    const json = await res.json();

    // All returned actions must belong to therapist, none to admin
    for (const action of json.data) {
      expect(action.actorId).toBe(therapistId);
      expect(action.actorId).not.toBe(adminId);
    }

    await context.close();
  });

  test("DSH-10: Super Admin Reports page (/super-admin/reports) renders metrics, charts, and export actions", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "super-admin.json"),
    });
    const page = await context.newPage();
    await page.goto("/super-admin/reports");

    // 1. Verify page title and header
    await expect(page.locator("body")).toContainText(/clinical operations & success analytics/i, { timeout: 10000 });

    // 2. Export buttons are visible and interactive
    await expect(page.getByTestId("export-excel-button")).toBeVisible();
    await expect(page.getByTestId("export-pdf-button")).toBeVisible();

    // 3. Therapist performance table is present
    await expect(page.locator("body")).toContainText(/therapist workload & performance ledger/i);

    await context.close();
  });

  test("DSH-11: Admin accessing /super-admin/reports is redirected away", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(authDir, "admin.json"),
    });
    const page = await context.newPage();
    await page.goto("/super-admin/reports");

    // Admin should be redirected away from super-admin reports
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    await context.close();
  });
});
