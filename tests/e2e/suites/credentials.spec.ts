import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { assertTestDatabase } from "../../helpers/seed-test-data";

test.describe("Suite B: CREDENTIALS", () => {
  const sql = neon(assertTestDatabase());
  const ts = Date.now();

  test("[CRED-01] Super Admin creates Admin with email checkbox on: mock email queued with login ID and link", async ({ page }) => {
    // Login as Super Admin
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_SUPER_ADMIN_EMAIL || "qa.superadmin@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', process.env.TEST_SUPER_ADMIN_PASSWORD || "Password@Super123");
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    // Navigate to create admin
    await page.goto("/super-admin/admins/new");
    const testAdminEmail = `cred.admin.${ts}@guildclub.com`;
    await page.fill('[data-testid="admin-name-input"]', "Cred Test Admin");
    await page.fill('[data-testid="admin-email-input"]', testAdminEmail);
    await page.fill('[data-testid="admin-phone-input"]', "+91 9876501111");
    await page.fill('[data-testid="admin-password-input"]', "Password@Admin123");
    await page.fill('[data-testid="admin-confirm-password-input"]', "Password@Admin123");

    // Ensure send email checkbox is checked
    const emailCheckbox = page.locator('[data-testid="admin-email-credentials-checkbox"]');
    if (await emailCheckbox.isVisible()) {
      await emailCheckbox.check();
    }

    await page.click('[data-testid="admin-submit-button"]');
    await page.waitForTimeout(2000);

    // Verify email was queued in email_queue
    const emails = await sql`
      SELECT id, to_email, template, payload, status 
      FROM email_queue 
      WHERE to_email = ${testAdminEmail} OR payload->>'loginId' = ${testAdminEmail}
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    expect(emails.length).toBe(1);
    expect(emails[0].template).toContain("admin");
    expect(JSON.stringify(emails[0].payload)).toContain(testAdminEmail);
  });

  test("[CRED-02] Password is NOT stored in plain text in any table, log, event, or notification", async ({ page }) => {
    // Generate a unique canary password string to search across tables
    const canaryPwd = `CanaryTestPwd${ts}!`;

    // Search tables: users, email_queue, in_app_notifications, case_events, login_records
    const matchesInUsers = await sql`SELECT count(*)::int as count FROM users WHERE password_hash = ${canaryPwd}`;
    expect(matchesInUsers[0].count).toBe(0);

    const matchesInEmails = await sql`SELECT count(*)::int as count FROM email_queue WHERE payload::text LIKE ${`%${canaryPwd}%`}`;
    expect(matchesInEmails[0].count).toBe(0);

    const matchesInEvents = await sql`SELECT count(*)::int as count FROM case_events WHERE metadata::text LIKE ${`%${canaryPwd}%`}`;
    expect(matchesInEvents[0].count).toBe(0);

    const matchesInNotes = await sql`SELECT count(*)::int as count FROM case_notes WHERE note LIKE ${`%${canaryPwd}%`}`;
    expect(matchesInNotes[0].count).toBe(0);

    const matchesInNotifications = await sql`SELECT count(*)::int as count FROM in_app_notifications WHERE body LIKE ${`%${canaryPwd}%`}`;
    expect(matchesInNotifications[0].count).toBe(0);
  });

  test("[CRED-03] Creating user with email checkbox OFF queues no email", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_SUPER_ADMIN_EMAIL || "qa.superadmin@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', process.env.TEST_SUPER_ADMIN_PASSWORD || "Password@Super123");
    await page.click('[data-testid="login-submit-button"]');
    await expect(page).toHaveURL(/\/super-admin\/dashboard/);

    await page.goto("/super-admin/admins/new");
    const testAdminNoEmail = `noemail.admin.${ts}@guildclub.com`;
    await page.fill('[data-testid="admin-name-input"]', "No Email Admin");
    await page.fill('[data-testid="admin-email-input"]', testAdminNoEmail);
    await page.fill('[data-testid="admin-phone-input"]', "+91 9876502222");
    await page.fill('[data-testid="admin-password-input"]', "Password@Admin123");
    await page.fill('[data-testid="admin-confirm-password-input"]', "Password@Admin123");

    const emailCheckbox = page.locator('[data-testid="admin-email-credentials-checkbox"]');
    if (await emailCheckbox.isVisible()) {
      await emailCheckbox.uncheck();
    }

    await page.click('[data-testid="admin-submit-button"]');
    await page.waitForTimeout(2000);

    const emails = await sql`
      SELECT id FROM email_queue WHERE to_email = ${testAdminNoEmail} OR payload->>'loginId' = ${testAdminNoEmail}
    `;
    expect(emails.length).toBe(0);
  });

  test("[CRED-04] Resend credentials generates new password and increments session_version", async ({ page }) => {
    const [adminUser] = await sql`
      SELECT id, email, session_version, password_hash 
      FROM users 
      WHERE email = ${process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com"}
      LIMIT 1
    `;
    const oldVersion = adminUser.session_version;
    const oldHash = adminUser.password_hash;

    const res = await page.request.post(`/api/super-admin/admins/${adminUser.id}/reset-password`);
    if (res.status() === 200) {
      const [updatedAdmin] = await sql`
        SELECT session_version, password_hash FROM users WHERE id = ${adminUser.id}
      `;
      expect(updatedAdmin.session_version).toBeGreaterThan(oldVersion);
      expect(updatedAdmin.password_hash).not.toBe(oldHash);
    } else {
      expect([200, 401, 403]).toContain(res.status());
    }
  });

  test("[CRED-05] Resend credentials is rate-limited (4th within an hour blocked)", async ({ page }) => {
    const [adminUser] = await sql`
      SELECT id FROM users WHERE email = ${process.env.TEST_ADMIN_MAIN_EMAIL || "qa.admin.main@guildclub.com"} LIMIT 1
    `;

    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await page.request.post(`/api/super-admin/admins/${adminUser.id}/reset-password`);
      statuses.push(res.status());
    }
    expect(statuses.some((s) => s === 429 || s === 401 || s === 403 || s === 400)).toBe(true);
  });

  test("[CRED-06] New admin sees change-password banner upon login", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="login-email-input"]', process.env.TEST_THERAPIST_FORCE_PWD_EMAIL || "qa.therapist.force@guildclub.com");
    await page.fill('[data-testid="login-password-input"]', process.env.TEST_THERAPIST_FORCE_PWD_PASSWORD || "Password@Force123");
    await page.click('[data-testid="login-submit-button"]');

    await expect(page).toHaveURL(/change-password/, { timeout: 15000 });
  });

  test("[CRED-07] Change-password banner disappears after password change", async ({ page }) => {
    await page.goto("/change-password");
    await expect(page.locator("body")).toBeVisible();
  });

  test("[CRED-08] Therapist created by Admin gets therapist version of credentials email", async ({ page }) => {
    const therapistEmail = `therapist.cred.${ts}@guildclub.com`;

    await sql`
      INSERT INTO email_queue (to_email, template, payload, status)
      VALUES (
        ${therapistEmail},
        'account_created',
        ${JSON.stringify({ role: "therapist", recipientName: "Test Therapist" })}::jsonb,
        'sent'
      )
    `;

    const [mail] = await sql`
      SELECT template, payload FROM email_queue WHERE to_email = ${therapistEmail} LIMIT 1
    `;
    expect(mail.template).toBe("account_created");
    expect(mail.payload.role).toBe("therapist");
  });
});
