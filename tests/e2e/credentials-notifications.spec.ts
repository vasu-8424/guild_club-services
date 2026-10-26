import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { renderCredentialsEmail } from "../../src/lib/notifications/credentials-sender";
import { assertTestDatabase } from "../helpers/seed-test-data";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users, cases, clients, inAppNotifications, caseEvents } from "../../src/db/schema";
import { eq, desc } from "drizzle-orm";

const screenshotDir = path.resolve(process.cwd(), "test-results/screenshots-ui");
const artifactDir = path.resolve(
  "C:/Users/admin/.gemini/antigravity-ide/brain/4dd1c48a-cf44-4402-9007-d61b84ecd817"
);

// Ensure directories exist
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

function copyToArtifacts(filename: string) {
  const src = path.join(screenshotDir, filename);
  const dest = path.join(artifactDir, filename);
  try {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  } catch (err) {
    console.warn(`Could not copy screenshot to artifacts: ${(err as Error).message}`);
  }
}

const SUPER_ADMIN = {
  email: process.env.TEST_SUPER_ADMIN_EMAIL || "test.superadmin@guildclub.com",
  password: process.env.TEST_SUPER_ADMIN_PASSWORD || "TestSuperAdmin@123",
};

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || "test.admin@guildclub.com",
  password: process.env.TEST_ADMIN_PASSWORD || "TestAdmin@123",
};

const THERAPIST = {
  email: process.env.TEST_THERAPIST_EMAIL || "test.therapist@guildclub.com",
  password: process.env.TEST_THERAPIST_PASSWORD || "TestTherapist@123",
};

test.describe("Credentials & Notifications Suite", () => {
  const timestamp = Date.now();
  const newAdmin = {
    name: "E2E Clinic Admin",
    email: `e2e.admin.${timestamp}@guildclubtest.com`,
    phone: "9876543210",
    initialPassword: "TemporaryPass@1234",
    updatedPassword: "PermanentPass@1234",
  };

  test("1. Feature 1: Super Admin creates Admin -> one-time credentials modal -> first login banner -> password changed & banner cleared", async ({ page }) => {
    test.setTimeout(90000);
    // 1. Super Admin logs in
    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(SUPER_ADMIN.email);
    await page.getByTestId("login-password-input").fill(SUPER_ADMIN.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15000 });

    // 2. Navigate to Add Admin form
    await page.goto("/super-admin/admins/new");
    await expect(page).toHaveURL(/\/super-admin\/admins\/new/);

    // 3. Verify checkbox is present and checked by default
    const emailCheckbox = page.getByTestId("admin-email-credentials-checkbox");
    await expect(emailCheckbox).toBeVisible();
    await expect(emailCheckbox).toBeChecked();

    // 4. Fill form
    await page.getByTestId("admin-name-input").fill(newAdmin.name);
    await page.getByTestId("admin-email-input").fill(newAdmin.email);
    await page.getByTestId("admin-phone-input").fill(newAdmin.phone);
    await page.getByTestId("admin-password-input").fill(newAdmin.initialPassword);
    await page.getByTestId("admin-confirm-password-input").fill(newAdmin.initialPassword);

    // 5. Submit form
    await page.getByTestId("admin-submit-button").click();

    // 6. One-time credentials dialog must be shown with email and password
    await expect(page.getByTestId("copy-credentials-button")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("credentials-email")).toContainText(newAdmin.email);
    await expect(page.getByTestId("credentials-password")).toContainText(newAdmin.initialPassword);

    // 7. Click done and verify redirection
    await page.getByTestId("done-button").click();
    await expect(page).toHaveURL(/\/super-admin\/admins/, { timeout: 10000 });

    // 8. Sign in as the newly created Admin
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(newAdmin.email);
    await page.getByTestId("login-password-input").fill(newAdmin.initialPassword);
    await page.getByTestId("login-submit-button").click();

    // 9. Admin lands on /admin/dashboard with temporary password banner visible
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    const banner = page.getByTestId("temporary-password-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("For security, please change your temporary password.");

    // 10. Click Profile > Change password link in banner
    await banner.getByRole("link", { name: /Profile > Change password/i }).click();
    await expect(page).toHaveURL(/\/change-password/, { timeout: 10000 });

    // 11. Complete password change form
    await page.getByTestId("current-password-input").fill(newAdmin.initialPassword);
    await page.getByTestId("new-password-input").fill(newAdmin.updatedPassword);
    await page.getByTestId("confirm-password-input").fill(newAdmin.updatedPassword);
    await page.getByTestId("change-password-submit-button").click();

    // 12. Returned to /admin/dashboard with the banner permanently removed
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page.getByTestId("temporary-password-banner")).toBeHidden();
  });

  test("2. Feature 2: Therapist closes case -> Notification bell badge -> Dropdown -> /notifications page -> Dashboard card", async ({ page }) => {
    test.setTimeout(90000);
    // 1. Setup test case in DB assigned to test therapist
    const connUrl = assertTestDatabase();
    const sql = neon(connUrl);
    const db = drizzle(sql);

    // Get Admin and Therapist IDs
    const [adminUser] = await db.select().from(users).where(eq(users.email, ADMIN.email)).limit(1);
    const [therapistUser] = await db.select().from(users).where(eq(users.email, THERAPIST.email)).limit(1);

    expect(adminUser).toBeDefined();
    expect(therapistUser).toBeDefined();

    // Insert client
    const [clientRec] = await db
      .insert(clients)
      .values({
        fullName: `E2E Client ${timestamp}`,
        age: 32,
        gender: "Female",
        email: `client.${timestamp}@example.com`,
        phone: "+91 9999988888",
      })
      .returning();

    // Insert active case
    const caseNumber = `GCS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const [caseRec] = await db
      .insert(cases)
      .values({
        caseNumber,
        clientId: clientRec.id,
        category: "individual",
        priority: "medium",
        description: "E2E clinical intake and treatment sessions.",
        status: "assigned",
        createdBy: adminUser.id,
        currentTherapistId: therapistUser.id,
      })
      .returning();

    // Record assignment event so notifyCaseClosed recognizes assigningAdmin
    await db.insert(caseEvents).values({
      caseId: caseRec.id,
      eventType: "case_assigned",
      actorId: adminUser.id,
      actorRole: "admin",
      metadata: {
        therapistId: therapistUser.id,
        assignedBy: adminUser.id,
      },
    });

    // 2. Therapist signs in and navigates to the case detail page
    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(THERAPIST.email);
    await page.getByTestId("login-password-input").fill(THERAPIST.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL(/\/therapist\/dashboard/, { timeout: 15000 });

    await page.goto(`/therapist/cases/${caseRec.id}`);
    await expect(page).toHaveURL(new RegExp(`/therapist/cases/${caseRec.id}`));

    // 3. Therapist closes the case with outcome "successful"
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByTestId("case-outcome-select").selectOption("successful");
    await page.getByTestId("case-closing-notes-input").fill("Patient met all milestones successfully.");
    await page.getByTestId("case-close-submit-button").click();

    // Verify status card reflects completed status
    await expect(page.getByText(/This case is archived in/i)).toBeVisible({ timeout: 15000 });

    // 4. Admin logs in to verify notifications
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByTestId("login-email-input").fill(ADMIN.email);
    await page.getByTestId("login-password-input").fill(ADMIN.password);
    await page.getByTestId("login-submit-button").click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    // 5. Verify notification bell has unread badge
    const bellBtn = page.getByTestId("notification-bell-btn");
    await expect(bellBtn).toBeVisible();
    const unreadBadge = page.getByTestId("notification-unread-badge");
    await expect(unreadBadge).toBeVisible({ timeout: 10000 });

    // 6. Click bell button to open dropdown
    await bellBtn.click();
    const dropdown = page.getByTestId("notification-dropdown");
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText(caseNumber);
    await expect(dropdown).toContainText("Successful");

    // 7. Verify recently closed cases card on Admin dashboard
    const closedCard = page.getByTestId("recently-closed-cases-card");
    await expect(closedCard).toBeVisible();
    await expect(closedCard).toContainText(caseNumber);
    await expect(closedCard).toContainText("Successful");

    // 8. Navigate to /notifications
    await page.goto("/notifications");
    await expect(page).toHaveURL(/\/notifications/);
    await expect(page.getByTestId("notifications-page")).toBeVisible();

    // Verify Tabs
    await expect(page.getByTestId("tab-all")).toBeVisible();
    await expect(page.getByTestId("tab-unread")).toBeVisible();
    await expect(page.getByTestId("tab-closed-cases")).toBeVisible();

    // Click Closed Cases tab
    await page.getByTestId("tab-closed-cases").click();
    await expect(page.getByText(caseNumber)).toBeVisible();

    // Mark all as read
    const markAllBtn = page.getByTestId("mark-all-notifications-read");
    if (await markAllBtn.isVisible()) {
      await markAllBtn.click();
      await expect(page.getByTestId("unread-count-badge")).toBeHidden({ timeout: 5000 });
    }
  });

  test("3. Capture required screenshots at 390px (mobile) and 1440px (desktop)", async ({ page }) => {
    test.setTimeout(90000);
    const viewports = [
      { name: "mobile-390", width: 390, height: 844 },
      { name: "desktop-1440", width: 1440, height: 900 },
    ];

    // Ensure Admin has at least one closed case notification
    const connUrl = assertTestDatabase();
    const sql = neon(connUrl);
    const db = drizzle(sql);
    const [adminUser] = await db.select().from(users).where(eq(users.email, ADMIN.email)).limit(1);

    if (adminUser) {
      await db.insert(inAppNotifications).values({
        userId: adminUser.id,
        type: "case_closed",
        title: "Case GCS-2026-8888 closed",
        body: "Closed by Dr. Test Therapist Active as Successful. 4 clinical sessions held.",
        priority: "normal",
        isRead: false,
        data: {
          outcome: "successful",
          caseNumber: "GCS-2026-8888",
          therapistName: "Dr. Test Therapist Active",
          sessionsCount: 4,
          closedAtIst: "25 Oct 2026, 07:30 PM IST",
        },
      });
    }

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // 1. Credentials email (rendered HTML preview)
      const credentialsEmail = renderCredentialsEmail({
        toEmail: "dr.priya.sharma@guildclubservices.com",
        toName: "Dr. Priya Sharma",
        role: "therapist",
        createdByName: "Clinic Administrator",
        password: "TherapistPass@2026",
        includePassword: true,
        baseUrl: "http://localhost:3000",
        replyTo: "support@shreespeechhearingandrehabilitation.com",
      });

      await page.setContent(credentialsEmail.html);
      await page.waitForTimeout(400);
      const emailFile = `credentials-email-${vp.name}.png`;
      await page.screenshot({
        path: path.join(screenshotDir, emailFile),
        fullPage: true,
      });
      copyToArtifacts(emailFile);

      // Log in as Admin for application UI screens
      await page.context().clearCookies();
      await page.goto("/login");
      await page.getByTestId("login-email-input").fill(ADMIN.email);
      await page.getByTestId("login-password-input").fill(ADMIN.password);
      await page.getByTestId("login-submit-button").click();
      await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

      // 2. Notification bell dropdown
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      const bell = page.getByTestId("notification-bell-btn");
      if (await bell.isVisible()) {
        await bell.click();
        await page.waitForTimeout(400);
        const bellFile = `notification-bell-dropdown-${vp.name}.png`;
        await page.screenshot({
          path: path.join(screenshotDir, bellFile),
          fullPage: false,
        });
        copyToArtifacts(bellFile);
      }

      // 3. Notifications page (/notifications)
      await page.goto("/notifications");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(600);
      const notifFile = `notifications-page-${vp.name}.png`;
      await page.screenshot({
        path: path.join(screenshotDir, notifFile),
        fullPage: true,
      });
      copyToArtifacts(notifFile);

      // 4. Admin dashboard with "Recently closed cases" card
      await page.goto("/admin/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(800);
      const dashFile = `admin-dashboard-closed-cases-${vp.name}.png`;
      await page.screenshot({
        path: path.join(screenshotDir, dashFile),
        fullPage: true,
      });
      copyToArtifacts(dashFile);
    }
  });
});
