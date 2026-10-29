import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";
import path from "path";
import fs from "fs";

test.describe("Suite K: ADMIN CREATION BRANCH SELECTION & ASSIGNMENT", () => {
  const sql = neon(assertTestDatabase());
  const artifactDir = "C:/Users/admin/.gemini/antigravity/brain/237e4596-e969-448f-b5d4-4fa509b8dbc3";
  const screenshotDir = path.resolve(process.cwd(), "test-results/screenshots-ui");

  // Ensure screenshot and artifact directories exist
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  function saveScreenshot(sourcePath: string, filename: string) {
    const dest = path.join(artifactDir, filename);
    try {
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, dest);
      }
    } catch (e) {
      console.warn("Could not copy screenshot to artifact dir:", e);
    }
  }

  const SUPER_ADMIN = {
    email: process.env.TEST_SUPER_ADMIN_EMAIL || "qa.superadmin@guildclub.com",
    password: process.env.TEST_SUPER_ADMIN_PASSWORD || "Password@Super123",
  };

  const ADMIN = {
    email: process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com",
    password: process.env.TEST_ADMIN_MAIN_PASSWORD || "Password@Admin123",
  };

  test.beforeEach(async () => {
    // Clear mock emails before each test
    try {
      await fetch("http://localhost:3000/api/email/mock", { method: "DELETE" });
    } catch {
      // ignore
    }
  });

  // TEST 1: The form shows the branch section; Save with no branch is blocked in UI & returns 400 via direct API
  test("[ADM-BR-01] Form shows branch section; save with no branch is blocked in UI and rejected by server (400)", async ({ page, request }) => {
    // 1. Log in as Super Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    // 2. Navigate to Add Admin
    await page.goto("/super-admin/admins/new");
    await expect(page).toHaveURL(/\/super-admin\/admins\/new/);

    // 3. Verify section structure: 1. Profile, 2. Branch access, 3. Credentials and access
    await expect(page.getByText("1. Profile", { exact: false })).toBeVisible();
    await expect(page.getByText("2. Branch access", { exact: false })).toBeVisible();
    await expect(page.getByText("3. Credentials and access", { exact: false })).toBeVisible();

    // Verify helper text
    await expect(page.getByTestId("assigned-branches-helper")).toHaveText(
      "The administrator can see only the selected branches. Required: choose at least one."
    );

    // 4. Fill profile and credentials fields
    await page.fill('[data-testid="admin-name-input"]', "No Branch Admin");
    await page.fill('[data-testid="admin-email-input"]', `nobranch.${Date.now()}@guildclub.com`);
    await page.fill('[data-testid="admin-phone-input"]', "+91 9876543210");
    await page.fill('[data-testid="admin-password-input"]', "ValidPassword@123");
    await page.fill('[data-testid="admin-confirm-password-input"]', "ValidPassword@123");

    // 5. Uncheck all branch checkboxes
    const checkboxes = page.locator('input[type="checkbox"][id^="branch-checkbox-"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      if (await checkboxes.nth(i).isChecked()) {
        await checkboxes.nth(i).uncheck();
      }
    }

    // 6. Attempt to Save
    await page.click('[data-testid="admin-submit-button"]');

    // UI blocks save: URL stays on /super-admin/admins/new, inline error appears
    await expect(page).toHaveURL(/\/super-admin\/admins\/new/);
    const errorMsg = page.getByTestId("branch-error-message");
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText("Choose at least one branch");

    // 7. Direct API test: Call POST /api/super-admin/admins without branches -> 400
    const apiRes = await page.request.post("/api/super-admin/admins", {
      data: {
        name: "API No Branch Admin",
        email: `api.nobranch.${Date.now()}@guildclub.com`,
        phone: "+91 9876543210",
        password: "ValidPassword@123",
        confirmPassword: "ValidPassword@123",
        branchIds: [],
      },
    });

    expect(apiRes.status()).toBe(400);
    const apiJson = await apiRes.json();
    expect(apiJson.error).toContain("Choose at least one branch");
  });

  // TEST 2: Create admin with two branches: user exists, 2 user_branches rows, email lists both branches, password absent from DB/outbox/events/notifications
  test("[ADM-BR-02] Create admin with two branches: user has 2 user_branches, email lists both branches, password never stored", async ({ page }) => {
    const ts = Date.now();
    const adminEmail = `two.branch.admin.${ts}@guildclub.com`;
    const adminName = `Dual Branch Admin ${ts}`;
    const canaryPassword = `CanaryPassDual${ts}!`;

    // 1. Get Main Branch and North Branch IDs from DB
    const [mainBranch] = await sql`SELECT id, name FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const [northBranch] = await sql`SELECT id, name FROM branches WHERE name = 'North Branch' LIMIT 1`;
    expect(mainBranch).toBeDefined();
    expect(northBranch).toBeDefined();

    // 2. Log in as Super Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    // 3. Open Add Admin form
    await page.goto("/super-admin/admins/new");
    await page.fill('[data-testid="admin-name-input"]', adminName);
    await page.fill('[data-testid="admin-email-input"]', adminEmail);
    await page.fill('[data-testid="admin-phone-input"]', "+91 9876543210");
    await page.fill('[data-testid="admin-password-input"]', canaryPassword);
    await page.fill('[data-testid="admin-confirm-password-input"]', canaryPassword);

    // Ensure email checkbox is checked
    const emailCheckbox = page.getByTestId("admin-email-credentials-checkbox");
    if (!(await emailCheckbox.isChecked())) {
      await emailCheckbox.check();
    }

    // Select both branches
    const mainBox = page.getByTestId(`branch-checkbox-${mainBranch.id}`);
    if (!(await mainBox.isChecked())) {
      await mainBox.check();
    }

    const northBox = page.getByTestId(`branch-checkbox-${northBranch.id}`);
    if (!(await northBox.isChecked())) {
      await northBox.check();
    }

    // Submit form
    await page.click('[data-testid="admin-submit-button"]');

    // 4. Verify one-time credentials modal shows email and branch names
    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("credentials-email")).toContainText(adminEmail);
    await expect(page.getByTestId("credentials-password")).toContainText(canaryPassword);
    const branchesDisplay = page.getByTestId("credentials-branches");
    await expect(branchesDisplay).toBeVisible();
    await expect(branchesDisplay).toContainText(mainBranch.name);
    await expect(branchesDisplay).toContainText(northBranch.name);

    // 5. Query database:
    // User exists with role admin
    const [createdUser] = await sql`SELECT id, name, email, role, password_hash FROM users WHERE email = ${adminEmail} LIMIT 1`;
    expect(createdUser).toBeDefined();
    expect(createdUser.role).toBe("admin");

    // Exactly 2 active user_branches rows
    const ubRows = await sql`
      SELECT id, branch_id, role_in_branch, assigned_by 
      FROM user_branches 
      WHERE user_id = ${createdUser.id} AND removed_at IS NULL
    `;
    expect(ubRows.length).toBe(2);
    const assignedBranchIds = ubRows.map((r: any) => r.branch_id);
    expect(assignedBranchIds).toContain(mainBranch.id);
    expect(assignedBranchIds).toContain(northBranch.id);
    expect(ubRows[0].role_in_branch).toBe("admin");
    expect(ubRows[1].role_in_branch).toBe("admin");

    // Audit events recorded
    const events = await sql`
      SELECT event_type, metadata 
      FROM case_events 
      WHERE target_user_id = ${createdUser.id}
    `;
    const eventTypes = events.map((e: any) => e.event_type);
    expect(eventTypes).toContain("admin_created");
    expect(eventTypes.filter((t: string) => t === "user_branch_added").length).toBe(2);

    // 6. Mock Email verification:
    // Email queue row payload contains branch names
    const [queued] = await sql`
      SELECT payload, status 
      FROM email_queue 
      WHERE payload->>'loginId' = ${adminEmail}
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    expect(queued).toBeDefined();
    const payloadStr = JSON.stringify(queued.payload);
    expect(payloadStr).toContain("Main Branch");
    expect(payloadStr).toContain("North Branch");

    // Verify sent email via mock API
    const mockRes = await fetch("http://localhost:3000/api/email/mock");
    if (mockRes.ok) {
      const mockData = await mockRes.json();
      const lastEmail = mockData.lastSentEmail;
      if (lastEmail) {
        expect(lastEmail.text).toContain("Main Branch");
        expect(lastEmail.text).toContain("North Branch");
        expect(lastEmail.text).toContain("Your branches:");
      }
    }

    // 7. Security: password is NEVER in database, outbox, events, or notifications
    expect(createdUser.password_hash).not.toBe(canaryPassword);

    const emailWithPwd = await sql`SELECT count(*)::int as c FROM email_queue WHERE payload::text LIKE ${`%${canaryPassword}%`}`;
    expect(emailWithPwd[0].c).toBe(0);

    const eventsWithPwd = await sql`SELECT count(*)::int as c FROM case_events WHERE metadata::text LIKE ${`%${canaryPassword}%`}`;
    expect(eventsWithPwd[0].c).toBe(0);

    const notifWithPwd = await sql`SELECT count(*)::int as c FROM in_app_notifications WHERE body LIKE ${`%${canaryPassword}%`}`;
    expect(notifWithPwd[0].c).toBe(0);
  });

  // TEST 3: Deactivated branch does NOT appear in list; direct API call with its id is rejected
  test("[ADM-BR-03] Deactivated branch does not appear in list; API call with its id is rejected (400)", async ({ page, request }) => {
    // 1. Create a deactivated branch in DB
    const deactBranchName = `Inactive Branch ${Date.now()}`;
    const [deactBranch] = await sql`
      INSERT INTO branches (name, is_active)
      VALUES (${deactBranchName}, false)
      RETURNING id, name
    `;

    // 2. Open create admin form
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/super-admin/admins/new");
    await expect(page.getByTestId("assigned-branches-field")).toBeVisible();

    // 3. Verify deactivated branch is NOT rendered
    const deactElement = page.getByTestId(`branch-checkbox-${deactBranch.id}`);
    await expect(deactElement).toHaveCount(0);
    const pageText = await page.content();
    expect(pageText).not.toContain(deactBranchName);

    // 4. Direct API call with deactivated branch ID is rejected with 400
    const apiRes = await page.request.post("/api/super-admin/admins", {
      data: {
        name: "Deactivated Branch Test",
        email: `deact.branch.${Date.now()}@guildclub.com`,
        phone: "+91 9876543210",
        password: "ValidPassword@123",
        confirmPassword: "ValidPassword@123",
        branchIds: [deactBranch.id],
      },
    });

    expect(apiRes.status()).toBe(400);
    const apiJson = await apiRes.json();
    expect(apiJson.error).toContain("deactivated");
  });

  // TEST 4: Admin calling the create action gets 403
  test("[ADM-BR-04] Admin calling the create action gets 403", async ({ page, request }) => {
    // 1. Log in as an Admin (not Super Admin)
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // 2. Attempt direct API POST to /api/super-admin/admins
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const res = await page.request.post("/api/super-admin/admins", {
      data: {
        name: "Unauthorized Creation",
        email: `unauth.admin.${Date.now()}@guildclub.com`,
        phone: "+91 9876543210",
        password: "Password@123",
        confirmPassword: "Password@123",
        branchIds: [mainBranch.id],
      },
    });

    expect(res.status()).toBe(403);
  });

  // TEST 5: Simulated email failure: admin & both branch rows created; warning & Resend action appear
  test("[ADM-BR-05] Simulated email failure: admin and branches created, warning and Resend action appear", async ({ page }) => {
    const ts = Date.now();
    const adminEmail = `email.fail.admin.${ts}@guildclub.com`;
    const adminName = `Fail Email Admin ${ts}`;

    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const [northBranch] = await sql`SELECT id FROM branches WHERE name = 'North Branch' LIMIT 1`;

    // 1. Simulate email failure in mock provider
    await fetch("http://localhost:3000/api/email/mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulateError: true,
        message: "Simulated SMTP timeout",
        times: 1,
      }),
    });

    // 2. Log in as Super Admin and fill form
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/super-admin/admins/new");
    await page.fill('[data-testid="admin-name-input"]', adminName);
    await page.fill('[data-testid="admin-email-input"]', adminEmail);
    await page.fill('[data-testid="admin-phone-input"]', "+91 9876543210");
    await page.fill('[data-testid="admin-password-input"]', "Password@Admin123");
    await page.fill('[data-testid="admin-confirm-password-input"]', "Password@Admin123");

    // Select both branches
    const mainBox = page.getByTestId(`branch-checkbox-${mainBranch.id}`);
    if (!(await mainBox.isChecked())) await mainBox.check();

    const northBox = page.getByTestId(`branch-checkbox-${northBranch.id}`);
    if (!(await northBox.isChecked())) await northBox.check();

    // Submit form
    await page.click('[data-testid="admin-submit-button"]');

    // 3. Modal appears with email delivery alert and "Resend credentials" button
    await expect(page.getByTestId("credentials-email-warning")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("resend-credentials-btn")).toBeVisible();

    // 4. Verify DB: user exists and both user_branches rows are committed!
    const [userRow] = await sql`SELECT id FROM users WHERE email = ${adminEmail} LIMIT 1`;
    expect(userRow).toBeDefined();

    const branchRows = await sql`SELECT id FROM user_branches WHERE user_id = ${userRow.id} AND removed_at IS NULL`;
    expect(branchRows.length).toBe(2);
  });

  // TEST 6: Log in as new admin: switcher lists only their two branches; third branch's cases return 404
  test("[ADM-BR-06] Log in as new admin: switcher lists only their 2 branches; 3rd branch cases return 404", async ({ page }) => {
    const ts = Date.now();
    const adminEmail = `scoped.admin.${ts}@guildclub.com`;
    const adminPassword = "Password@AdminScoped123";

    // 1. Get/create 3 branches: Main, North, and East
    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const [northBranch] = await sql`SELECT id FROM branches WHERE name = 'North Branch' LIMIT 1`;

    let [eastBranch] = await sql`SELECT id FROM branches WHERE name = 'East Branch' LIMIT 1`;
    if (!eastBranch) {
      [eastBranch] = await sql`INSERT INTO branches (name, is_active) VALUES ('East Branch', true) RETURNING id`;
    }

    // Create a case in East Branch
    const [client] = await sql`SELECT id FROM clients LIMIT 1`;
    const [superAdminUser] = await sql`SELECT id FROM users WHERE email = ${SUPER_ADMIN.email} LIMIT 1`;
    const [eastCase] = await sql`
      INSERT INTO cases (case_number, client_id, branch_id, service, category, priority, description, created_by, status)
      VALUES (${`GCS-EAST-${ts}`}, ${client.id}, ${eastBranch.id}, 'General Therapy', 'speech', 'medium', 'Test East Case Description', ${superAdminUser.id}, 'active')
      RETURNING id
    `;

    // 2. Create the admin with ONLY Main Branch and North Branch (via direct API or form)
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    const createRes = await page.request.post("/api/super-admin/admins", {
      data: {
        name: `Scoped Admin ${ts}`,
        email: adminEmail,
        phone: "+91 9876543210",
        password: adminPassword,
        confirmPassword: adminPassword,
        branchIds: [mainBranch.id, northBranch.id],
      },
    });
    expect(createRes.status()).toBe(200);

    // 3. Log in as the new admin
    await page.context().clearCookies();
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', adminEmail);
    await page.fill('[data-testid="login-password-input"]', adminPassword);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 4. Verify branch switcher dropdown contains Main Branch and North Branch, but NOT East Branch
    const switcher = page.getByTestId("branch-switcher-select");
    await expect(switcher).toBeVisible();
    const optionsText = await switcher.innerText();
    expect(optionsText).toContain("Main Branch");
    expect(optionsText).toContain("North Branch");
    expect(optionsText).not.toContain("East Branch");

    // 5. Attempt direct access to East Branch case -> 404
    const caseRes = await page.goto(`/cases/${eastCase.id}/report`);
    expect([404, 403]).toContain(caseRes?.status());
  });

  // TEST 7: Editing branches: removing one of two branches works; removing the last one is blocked
  test("[ADM-BR-07] Editing branches: removing 1 of 2 works; removing the last one is blocked", async ({ page }) => {
    const ts = Date.now();
    const adminEmail = `edit.branch.admin.${ts}@guildclub.com`;
    const adminPassword = "Password@EditBranch123";

    const [mainBranch] = await sql`SELECT id FROM branches WHERE name = 'Main Branch' LIMIT 1`;
    const [northBranch] = await sql`SELECT id FROM branches WHERE name = 'North Branch' LIMIT 1`;

    // 1. Log in as Super Admin first
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    // 2. Create admin with Main and North branches using authenticated page.request
    const createRes = await page.request.post("/api/super-admin/admins", {
      data: {
        name: `Edit Test Admin ${ts}`,
        email: adminEmail,
        phone: "+91 9876543210",
        password: adminPassword,
        confirmPassword: adminPassword,
        branchIds: [mainBranch.id, northBranch.id],
      },
    });
    const createData = await createRes.json();
    const adminId = createData.data.id;

    // 3. Navigate to Admins list
    await page.goto("/super-admin/admins");
    await expect(page.getByTestId(`admin-name-${adminId}`)).toBeVisible();

    // 4. Open kebab row menu and click "Edit branches"
    const kebabBtn = page.getByTestId(`row-actions-kebab-${adminId}`);
    await kebabBtn.click();

    const editBranchesBtn = page.getByTestId(`edit-branches-btn-${adminId}`);
    await expect(editBranchesBtn).toBeVisible();
    await editBranchesBtn.click();

    // 5. Modal is visible
    await expect(page.getByTestId("edit-branches-modal")).toBeVisible();

    // Uncheck North Branch
    const northCheckbox = page.getByTestId(`edit-branch-checkbox-${northBranch.id}`);
    expect(await northCheckbox.isChecked()).toBe(true);
    await northCheckbox.uncheck();

    // Save changes
    await page.click('[data-testid="save-branches-button"]');

    // Modal closes
    await expect(page.getByTestId("edit-branches-modal")).toHaveCount(0);

    // Verify DB: North Branch row has removed_at set, Main Branch remains active
    const activeUb = await sql`
      SELECT branch_id FROM user_branches 
      WHERE user_id = ${adminId} AND removed_at IS NULL
    `;
    expect(activeUb.length).toBe(1);
    expect(activeUb[0].branch_id).toBe(mainBranch.id);

    const removedEvent = await sql`
      SELECT event_type FROM case_events 
      WHERE target_user_id = ${adminId} AND event_type = 'user_branch_removed'
    `;
    expect(removedEvent.length).toBe(1);

    // 6. Open modal again and try removing the last branch
    await kebabBtn.click();
    await editBranchesBtn.click();
    await expect(page.getByTestId("edit-branches-modal")).toBeVisible();

    const mainCheckbox = page.getByTestId(`edit-branch-checkbox-${mainBranch.id}`);
    expect(await mainCheckbox.isChecked()).toBe(true);
    await mainCheckbox.uncheck();

    // Error is shown and save blocked
    const modalError = page.getByTestId("edit-branches-error");
    await expect(modalError).toBeVisible();
    await expect(modalError).toContainText("An administrator must keep at least one branch");

    await page.click('[data-testid="save-branches-button"]');
    await expect(page.getByTestId("edit-branches-modal")).toBeVisible();

    // Direct API call attempting to remove all branches returns 400
    const apiRes = await page.request.patch(`/api/super-admin/admins/${adminId}/branches`, {
      data: { branchIds: [] },
    });
    expect(apiRes.status()).toBe(400);
    const apiJson = await apiRes.json();
    expect(apiJson.error).toContain("An administrator must keep at least one branch");
  });

  // TEST 8: Screenshots of the form (with the branch section) and the success dialog at 390px and 1440px
  test("[ADM-BR-08] Screenshots of the form (with branch section) and success dialog at 390px and 1440px", async ({ page }) => {
    const viewports = [
      { name: "390px", width: 390, height: 844 },
      { name: "1440px", width: 1440, height: 900 },
    ];

    // Log in as Super Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', SUPER_ADMIN.email);
    await page.fill('[data-testid="login-password-input"]', SUPER_ADMIN.password);
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1. Screenshot of the Create Admin form with branch section
      await page.goto("/super-admin/admins/new");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(500);

      const formScreenshotPath = path.join(screenshotDir, `create-admin-form-with-branches-${vp.name}.png`);
      await page.screenshot({ path: formScreenshotPath, fullPage: true });
      saveScreenshot(formScreenshotPath, `create-admin-form-with-branches-${vp.name}.png`);

      // Fill and submit form to capture success dialog
      const ts = Date.now() + Math.floor(Math.random() * 1000);
      await page.fill('[data-testid="admin-name-input"]', `Screenshot Admin ${vp.name}`);
      await page.fill('[data-testid="admin-email-input"]', `screenshot.${vp.name}.${ts}@guildclub.com`);
      await page.fill('[data-testid="admin-phone-input"]', "+91 9876543210");
      await page.fill('[data-testid="admin-password-input"]', "Password@Admin123");
      await page.fill('[data-testid="admin-confirm-password-input"]', "Password@Admin123");

      // Check all available branch checkboxes
      const checkboxes = page.locator('input[type="checkbox"][id^="branch-checkbox-"]');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        if (!(await checkboxes.nth(i).isChecked())) {
          await checkboxes.nth(i).check();
        }
      }

      await page.click('[data-testid="admin-submit-button"]');
      await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(400);

      const successScreenshotPath = path.join(screenshotDir, `create-admin-success-dialog-${vp.name}.png`);
      await page.screenshot({ path: successScreenshotPath, fullPage: true });
      saveScreenshot(successScreenshotPath, `create-admin-success-dialog-${vp.name}.png`);
    }
  });
});
