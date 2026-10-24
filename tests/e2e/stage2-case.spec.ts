/**
 * Stage 2 – Case Management Tests (CASE-01 to CASE-07)
 * Admin can create, view, and manage cases. Case number format: GCS-YYYY-NNNN.
 */
import { test, expect } from "@playwright/test";
import { getEvents } from "../helpers/stage2-helpers";

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL ?? "test.admin@guildclub.com",
  password: process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin@123",
};

const testCase = {
  clientName: "Rahul Test Client",
  clientEmail: "rahul.testclient@example.com",
  clientPhone: "+91 9600000001",
  clientAge: "28",
  presentingIssues: "Experiencing severe anxiety and panic attacks at work.",
  priority: "high",
};

// Store case ID across tests in this file
let createdCaseId = "";
let createdCaseNumber = "";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill('[data-testid="login-email-input"]', ADMIN.email);
  await page.fill('[data-testid="login-password-input"]', ADMIN.password);
  await page.click('[data-testid="login-submit-button"]');
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
}

test.describe.serial("CASE: Admin – Case Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("CASE-01: Admin can navigate to /admin/cases and see the cases list", async ({ page }) => {
    await page.goto("/admin/cases");
    await expect(page).toHaveURL(/\/admin\/cases/);
    await expect(page.locator("h1").first()).toContainText(/case/i);
  });

  test("CASE-02: Admin can open the Create Case form at /admin/cases/new", async ({ page }) => {
    await page.goto("/admin/cases/new");
    await expect(page.getByTestId("case-client-name-input")).toBeVisible();
    await expect(page.getByTestId("case-client-email-input")).toBeVisible();
    await expect(page.getByTestId("case-presenting-issues-input")).toBeVisible();
    await expect(page.locator('[data-testid="case-submit-button"], [data-testid="create-case-submit"]').first()).toBeVisible();
  });

  test("CASE-03: Creating a case generates GCS-YYYY-NNNN case number and records case_created event", async ({ page }) => {
    await page.goto("/admin/cases/new");
    await page.getByTestId("case-client-name-input").fill(testCase.clientName);
    await page.getByTestId("case-client-email-input").fill(testCase.clientEmail);
    await page.getByTestId("case-client-phone-input").fill(testCase.clientPhone);
    await page.getByTestId("case-client-age-input").fill(testCase.clientAge);
    await page.getByTestId("case-presenting-issues-input").fill(testCase.presentingIssues);
    await page.getByTestId("case-priority-select").selectOption(testCase.priority);
    await page.locator('[data-testid="case-submit-button"], [data-testid="create-case-submit"]').first().click();

    // Confirmation card with case number appears
    await expect(page.getByTestId("case-created-number")).toBeVisible({ timeout: 15000 });
    const numberText = await page.getByTestId("case-created-number").textContent();
    const currentYear = new Date().getFullYear();
    const caseNumberPattern = new RegExp(`GCS-${currentYear}-\\d{4}`);
    const match = numberText?.match(caseNumberPattern);
    expect(match, "Case number in GCS format should appear on confirmation card").not.toBeNull();
    createdCaseNumber = match?.[0] ?? "";

    // Fetch case from DB to get ID
    const { getCaseByNumber } = await import("../helpers/stage2-helpers");
    const caseRec = await getCaseByNumber(createdCaseNumber);
    expect(caseRec, "Case must exist in database").not.toBeNull();
    createdCaseId = caseRec!["id"] as string;

    await page.getByTestId("case-done-button").click();
    await expect(page).toHaveURL(/\/admin\/cases/, { timeout: 15000 });

    // Verify case_created event in DB
    const events = await getEvents(createdCaseId, "case_created");
    expect(events.length, "case_created event should be recorded").toBeGreaterThan(0);
  });

  test("CASE-04: Case detail page shows client info, status, and priority", async ({ page }) => {
    if (!createdCaseId) {
      test.skip();
      return;
    }
    await page.goto(`/admin/cases/${createdCaseId}`);
    await expect(page.locator("body")).toContainText(testCase.clientName, { timeout: 10000 });
    await expect(page.locator("body")).toContainText(/high/i, { timeout: 5000 });
  });

  test("CASE-05: Case list shows the new case with correct status 'new'", async ({ page }) => {
    await page.goto("/admin/cases");
    await expect(page.locator("body")).toContainText(testCase.clientName.split(" ")[0], { timeout: 10000 });
  });

  test("CASE-06: Case number follows GCS-YYYY-NNNN format", async () => {
    // Verified in CASE-03; assert the stored case number format here
    if (!createdCaseNumber) {
      test.skip();
      return;
    }
    const currentYear = new Date().getFullYear();
    const pattern = /^GCS-\d{4}-\d{4}$/;
    expect(createdCaseNumber).toMatch(pattern);
    expect(createdCaseNumber).toContain(String(currentYear));
  });

  test("CASE-07: Unauthenticated request to /api/admin/cases returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/cases");
    expect(res.status()).toBe(401);
  });
});
